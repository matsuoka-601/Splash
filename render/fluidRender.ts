import depthFilter from './narrowRangeFilter.wgsl'
import fluid from './fluid.wgsl'
import fullScreen from './fullScreen.wgsl'
import thicknessMap from './thicknessMap.wgsl'
import gaussian from './gaussian.wgsl'
import depthMap from './depthMap.wgsl'
import sphere from './sphere.wgsl'
import bgColor from './bgColor.wgsl'
import densityRaymarch from './densityRaymarch.wgsl'


export class FluidRenderer {
    depthFilter1DPipeline: GPURenderPipeline
    depthFilter2DPipeline: GPURenderPipeline
    thicknessMapPipeline: GPURenderPipeline
    thicknessFilterPipeline: GPURenderPipeline
    fluidPipeline: GPURenderPipeline
    depthMapPipeline: GPURenderPipeline
    spherePipeline: GPURenderPipeline
    bgColorPipeline: GPURenderPipeline
    densityRaymarchPipeline: GPURenderPipeline

    depthMapTextureView: GPUTextureView
    tmpDepthMapTextureView: GPUTextureView
    thicknessTextureView: GPUTextureView
    tmpThicknessTextureView: GPUTextureView
    depthTestTextureView: GPUTextureView
    tmpOutputTextureView: GPUTextureView
    
    depthFilter1DBindGroups: GPUBindGroup[]
    depthFilter2DBindGroups: GPUBindGroup[]
    thicknessMapBindGroup: GPUBindGroup
    thicknessFilterBindGroups: GPUBindGroup[]
    fluidBindGroup: GPUBindGroup
    depthMapBindGroup: GPUBindGroup
    sphereBindGroup: GPUBindGroup
    bgColorBindGroup: GPUBindGroup
    densityRaymarchBindGroup: GPUBindGroup

    diffuseColorBuffer: GPUBuffer
    colorDensityBuffer: GPUBuffer

    device: GPUDevice

    constructor(
        renderUniformBuffer: GPUBuffer, posvelBuffer: GPUBuffer, densityGridBuffer: GPUBuffer, densityGridSizeBuffer: GPUBuffer, initBoxSizeBuffer: GPUBuffer, 
        device: GPUDevice, 
        depthMapTextureView: GPUTextureView, cubemapTextureView: GPUTextureView, 
        canvas: HTMLCanvasElement, 
        presentationFormat: GPUTextureFormat,
        radius: number, fov: number, fixedPointMultiplier: number, 
    ) {
        this.device = device
        const maxFilterSize = 50
        const diameter = 2 * radius
        const blurFilterSize = 12
        const thicknessTextureWidth = canvas.width / 2;
        const thicknessTextureHeight = canvas.height / 2;

        const screenConstants = {
            'screenHeight': canvas.height, 
            'screenWidth': canvas.width, 
        }
        const filterConstants = {
            'maxFilterSize' : maxFilterSize, 
            'projectedParticleConstant' : (blurFilterSize * diameter * 0.05 * (canvas.height / 2)) / Math.tan(fov / 2), 
        }
        const thicknessTextureConstants = {
            'thicknessTextureWidth' : thicknessTextureWidth, 
            'thicknessTextureHeight' : thicknessTextureHeight, 
        }
        const sampler = device.createSampler({
            // addressModeU: "repeat",
            // addressModeV: "repeat",
            magFilter: 'linear', 
            minFilter: 'linear'
        });

        const vertexModule = device.createShaderModule({ code: fullScreen })
        const depthFilterModule = device.createShaderModule({ code: depthFilter })
        const fluidModule = device.createShaderModule({ code: fluid })
        const depthMapModule = device.createShaderModule({ code: depthMap })
        const sphereModule = device.createShaderModule({ code: sphere })
        const thicknessMapModule = device.createShaderModule({ code: thicknessMap })
        const thicknessFilterModule = device.createShaderModule({ code: gaussian })
        const bgColorModule = device.createShaderModule({ code: bgColor })
        const densityRaymarchModule = device.createShaderModule({ code: densityRaymarch })

        // pipelines
        this.depthMapPipeline = device.createRenderPipeline({
            label: 'depthMap pipeline', 
            layout: 'auto', 
            vertex: { module: depthMapModule }, 
            fragment: {
                module: depthMapModule, 
                targets: [
                    {
                        format: 'r32float',
                    },
                ]
            }, 
            primitive: {
                topology: 'triangle-list', 
            },
            depthStencil: {
                depthWriteEnabled: true, 
                depthCompare: 'less',
                format: 'depth32float'
            }
        })
        this.spherePipeline = device.createRenderPipeline({
            label: 'sphere pipeline', 
            layout: 'auto', 
            vertex: { module: sphereModule }, 
            fragment: {
                module: sphereModule, 
                targets: [
                    {
                        format: 'r32float',
                    },
                    {
                        format: presentationFormat,
                    },
                ]
            }, 
            primitive: {
                topology: 'triangle-list', 
            },
            depthStencil: {
                depthWriteEnabled: true, 
                depthCompare: 'less',
                format: 'depth32float'
            }
        })
        this.depthFilter1DPipeline = device.createRenderPipeline({
            label: 'depth filter pipeline (1d)', 
            layout: 'auto', 
            vertex: { 
                module: vertexModule,  
                constants: screenConstants
            },
            fragment: {
                module: depthFilterModule, 
                constants: {
                    ...filterConstants,
                    'blur2D' : 0
                }, 
                targets: [
                    {
                        format: 'r32float',
                    },
                ],
            },
            primitive: {
                topology: 'triangle-list',
            },
        });
        this.depthFilter2DPipeline = device.createRenderPipeline({
            label: 'depth filter pipeline (2d)', 
            layout: 'auto', 
            vertex: { 
                module: vertexModule,  
                constants: screenConstants
            },
            fragment: {
                module: depthFilterModule, 
                constants: {
                    ...filterConstants,
                    'blur2D' : 1
                },
                targets: [
                    {
                        format: 'r32float',
                    },
                ],
            },
            primitive: {
                topology: 'triangle-list',
            },
        });
        this.thicknessMapPipeline = device.createRenderPipeline({
            label: 'thickness map pipeline', 
            layout: 'auto', 
            vertex: { 
                module: thicknessMapModule, 
            }, 
            fragment: {
                module: thicknessMapModule, 
                targets: [
                    {
                        format: 'r16float',
                        writeMask: GPUColorWrite.RED,
                        blend: {
                            color: { operation: 'add', srcFactor: 'one', dstFactor: 'one' },
                            alpha: { operation: 'add', srcFactor: 'one', dstFactor: 'one' },
                        }
                    }
                ],
            }, 
            primitive: {
                topology: 'triangle-list', 
            },
        });
        this.thicknessFilterPipeline = device.createRenderPipeline({
            label: 'thickness filter pipeline', 
            layout: 'auto', 
            vertex: { 
                module: vertexModule,  
                constants: screenConstants
            },
            fragment: {
                module: thicknessFilterModule,
                constants: thicknessTextureConstants, 
                targets: [
                    {
                        format: 'r16float',
                    },
                ],
            },
            primitive: {
                topology: 'triangle-list', 
            },
        });
        this.fluidPipeline = device.createRenderPipeline({
            label: 'fluid rendering pipeline', 
            layout: 'auto', 
            vertex: { 
                module: vertexModule,  
                constants: screenConstants
            }, 
            fragment: {
                module: fluidModule, 
                targets: [
                    {
                        format: presentationFormat
                    }
                ],
            }, 
            primitive: {
                topology: 'triangle-list',
            },
        });
        this.bgColorPipeline = device.createRenderPipeline({
            label: 'bgColor pipeline', 
            layout: 'auto', 
            vertex: { 
                module: vertexModule,  
                constants: screenConstants
            }, 
            fragment: {
                module: bgColorModule, 
                targets: [
                    {
                        format: presentationFormat
                    }
                ],
            }, 
            primitive: {
                topology: 'triangle-list',
            },
        })
        this.densityRaymarchPipeline = device.createRenderPipeline({
            label: 'density raymarch pipeline', 
            layout: 'auto', 
            vertex: {
                module: vertexModule, 
                constants: screenConstants
            },
            fragment: {
                module: densityRaymarchModule, 
                constants: {
                    'fixedPointMultiplier': fixedPointMultiplier
                }, 
                targets: [
                    {
                        format: presentationFormat
                    }
                ]
            }
        })

        // textures
        const tmpDepthMapTexture = device.createTexture({ 
            label: 'temporary depth map texture', 
            size: [canvas.width, canvas.height, 1],
            usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
            format: 'r32float',
        });
        const thicknessTexture = device.createTexture({
            label: 'thickness map texture', 
            size: [thicknessTextureWidth, thicknessTextureHeight, 1],
            usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
            format: 'r16float',
        });
        const tmpThicknessTexture = device.createTexture({
            label: 'temporary thickness map texture', 
            size: [thicknessTextureWidth, thicknessTextureHeight, 1],
            usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
            format: 'r16float',
        });
        const depthTestTexture = device.createTexture({
            size: [canvas.width, canvas.height, 1],
            format: 'depth32float',
            usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
        })
        const tmpOutputTexture = device.createTexture({
            size: [canvas.width, canvas.height, 1],
            format: presentationFormat,
            usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
        })
        this.depthMapTextureView = depthMapTextureView
        this.tmpDepthMapTextureView = tmpDepthMapTexture.createView()
        this.thicknessTextureView = thicknessTexture.createView()
        this.tmpThicknessTextureView = tmpThicknessTexture.createView()
        this.depthTestTextureView = depthTestTexture.createView()
        this.tmpOutputTextureView = tmpOutputTexture.createView()

        // buffer
        const filterXUniformsValues = new ArrayBuffer(8)
        const filterYUniformsValues = new ArrayBuffer(8)
        const thicknessFilterSizeValues = new ArrayBuffer(4);
        const filterXUniformsViews = new Float32Array(filterXUniformsValues)
        const filterYUniformsViews = new Float32Array(filterYUniformsValues) 
        const thicknessFilterSizeViews = new Int32Array(thicknessFilterSizeValues) 
        filterXUniformsViews.set([1.0, 0.0])
        filterYUniformsViews.set([0.0, 1.0])
        thicknessFilterSizeViews.set([15])
        const filterXUniformBuffer = device.createBuffer({
            label: 'filter uniform buffer', 
            size: filterXUniformsValues.byteLength, 
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        })
        const filterYUniformBuffer = device.createBuffer({
            label: 'filter uniform buffer', 
            size: filterYUniformsValues.byteLength, 
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        })
        const thicknessFilterSizeBuffer = device.createBuffer({
            label: 'thickness filter size buffer', 
            size: thicknessFilterSizeValues.byteLength, 
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        })
        this.diffuseColorBuffer = device.createBuffer({
            label: 'diffuse color buffer', 
            size: 12, 
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        })
        this.colorDensityBuffer = device.createBuffer({
            label: 'color density buffer', 
            size: 4, 
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        })
        device.queue.writeBuffer(filterXUniformBuffer, 0, filterXUniformsValues);
        device.queue.writeBuffer(filterYUniformBuffer, 0, filterYUniformsValues);
        device.queue.writeBuffer(thicknessFilterSizeBuffer, 0, thicknessFilterSizeValues);

        // bindGroup
        this.depthFilter1DBindGroups = []
        this.depthFilter1DBindGroups = [
            device.createBindGroup({
                label: 'filterX bind group', 
                layout: this.depthFilter1DPipeline.getBindGroupLayout(0),
                entries: [
                    // { binding: 0, resource: sampler },
                    { binding: 1, resource: this.depthMapTextureView }, 
                    { binding: 2, resource: { buffer: filterXUniformBuffer } },
                ],
            }), 
            device.createBindGroup({
                label: 'filterY bind group', 
                layout: this.depthFilter1DPipeline.getBindGroupLayout(0),
                entries: [
                    // { binding: 0, resource: sampler },
                    { binding: 1, resource: this.tmpDepthMapTextureView }, 
                    { binding: 2, resource: { buffer: filterYUniformBuffer }}
                ],
            })
        ];
        this.depthFilter2DBindGroups = [
            device.createBindGroup({
                label: 'filterX bind group', 
                layout: this.depthFilter2DPipeline.getBindGroupLayout(0),
                entries: [
                    // { binding: 0, resource: sampler },
                    { binding: 1, resource: this.depthMapTextureView }, 
                    { binding: 2, resource: { buffer: filterXUniformBuffer } },
                ],
            }), 
            device.createBindGroup({
                label: 'filterY bind group', 
                layout: this.depthFilter2DPipeline.getBindGroupLayout(0),
                entries: [
                    // { binding: 0, resource: sampler },
                    { binding: 1, resource: this.tmpDepthMapTextureView },
                    { binding: 2, resource: { buffer: filterYUniformBuffer }}
                ],
            })
        ];
        this.thicknessMapBindGroup = device.createBindGroup({
            label: 'thickness map bind group', 
            layout: this.thicknessMapPipeline.getBindGroupLayout(0),
            entries: [
                { binding: 0, resource: { buffer: posvelBuffer }},
                { binding: 1, resource: { buffer: renderUniformBuffer }}, 
            ],
        })
        this.thicknessFilterBindGroups = []
        this.thicknessFilterBindGroups = [
            device.createBindGroup({
                label: 'thickness filterX bind group', 
                layout: this.thicknessFilterPipeline.getBindGroupLayout(0),
                entries: [
                    { binding: 0, resource: sampler },
                    { binding: 1, resource: this.thicknessTextureView }, 
                    { binding: 2, resource: { buffer: filterXUniformBuffer } }, 
                    { binding: 3, resource: { buffer: thicknessFilterSizeBuffer }}
                ],
            }), 
            device.createBindGroup({
                label: 'thickness filterY bind group', 
                layout: this.thicknessFilterPipeline.getBindGroupLayout(0),
                entries: [
                    { binding: 0, resource: sampler },
                    { binding: 1, resource: this.tmpThicknessTextureView }, 
                    { binding: 2, resource: { buffer: filterYUniformBuffer } }, 
                    { binding: 3, resource: { buffer: thicknessFilterSizeBuffer }}
                ],
            }), 
        ]

        this.fluidBindGroup = device.createBindGroup({
            label: 'fluid bind group', 
            layout: this.fluidPipeline.getBindGroupLayout(0),
            entries: [
              { binding: 0, resource: sampler },
              { binding: 1, resource: this.depthMapTextureView },
              { binding: 2, resource: { buffer: renderUniformBuffer } },
              { binding: 3, resource: this.thicknessTextureView },
              { binding: 4, resource: cubemapTextureView }, 
              { binding: 5, resource: this.tmpOutputTextureView }, 
              { binding: 6, resource: { buffer: this.diffuseColorBuffer }}, 
              { binding: 7, resource: { buffer: this.colorDensityBuffer }}, 
            ],
        })

        this.depthMapBindGroup = device.createBindGroup({
            label: 'depthMap bind group', 
            layout: this.depthMapPipeline.getBindGroupLayout(0),  
            entries: [
                { binding: 0, resource: { buffer: posvelBuffer }},
                { binding: 1, resource: { buffer: renderUniformBuffer }},
            ]
        })

        this.bgColorBindGroup = device.createBindGroup({
            label: 'bgColor bind group', 
            layout: this.bgColorPipeline.getBindGroupLayout(0),  
            entries: [
                { binding: 0, resource: cubemapTextureView },
                { binding: 1, resource: { buffer: renderUniformBuffer }},
                { binding: 2, resource: sampler }, 
            ]
        })

        this.sphereBindGroup = device.createBindGroup({
            label: 'sphere bind group', 
            layout: this.spherePipeline.getBindGroupLayout(0),  
            entries: [
                { binding: 0, resource: { buffer: posvelBuffer }},
                { binding: 1, resource: { buffer: renderUniformBuffer }},
            ]
        })

        this.densityRaymarchBindGroup = device.createBindGroup({
            label: 'density raymarch bind group', 
            layout: this.densityRaymarchPipeline.getBindGroupLayout(0),  
            entries: [
                { binding: 0, resource: this.depthMapTextureView },
                { binding: 1, resource: { buffer: densityGridBuffer }},
                { binding: 2, resource: { buffer: renderUniformBuffer }}, 
                { binding: 3, resource: { buffer: initBoxSizeBuffer }}, 
                { binding: 4, resource: sampler }, 
                { binding: 5, resource: this.tmpOutputTextureView }, 
                { binding: 6, resource: { buffer: densityGridSizeBuffer }}
            ]
        })
    }


    execute(context: GPUCanvasContext, commandEncoder: GPUCommandEncoder, 
        numParticles: number, sphereRenderFl: boolean, diffuseColor: number[], colorDensity: number) 
    {
        const diffuseColorValues = new ArrayBuffer(12)
        const diffuseColorViews = new Float32Array(diffuseColorValues)
        const colorDensityValues = new ArrayBuffer(4)
        const colorDensityViews = new Float32Array(colorDensityValues)
        diffuseColorViews.set(diffuseColor)
        colorDensityViews.set([colorDensity])
        this.device.queue.writeBuffer(this.diffuseColorBuffer, 0, diffuseColorViews)
        this.device.queue.writeBuffer(this.colorDensityBuffer, 0, colorDensityViews)

        const depthFilterPassDescriptors: GPURenderPassDescriptor[] = [
            {
                colorAttachments: [
                    {
                        view: this.tmpDepthMapTextureView, 
                        clearValue: { r: 1e6, g: 0.0, b: 0.0, a: 1.0 },
                        loadOp: 'clear',
                        storeOp: 'store',
                    },
                ],
            }, 
            {
                colorAttachments: [
                    {
                        view: this.depthMapTextureView, 
                        clearValue: { r: 1e6, g: 0.0, b: 0.0, a: 1.0 },
                        loadOp: 'clear',
                        storeOp: 'store',
                    },
                ],
            }
        ]

        const thicknessMapPassDescriptor: GPURenderPassDescriptor = {
            colorAttachments: [
                {
                    view: this.thicknessTextureView, 
                    clearValue: { r: 0.0, g: 0.0, b: 0.0, a: 1.0 },
                    loadOp: 'clear',
                    storeOp: 'store',
                },
            ],
        }

        const thicknessFilterPassDescriptors: GPURenderPassDescriptor[] = [
            {
                colorAttachments: [
                    {
                        view: this.tmpThicknessTextureView, 
                        clearValue: { r: 0.0, g: 0.0, b: 0.0, a: 1.0 },
                        loadOp: 'clear',
                        storeOp: 'store',
                    },
                ],
            }, 
            {
                colorAttachments: [
                    {
                        view: this.thicknessTextureView, 
                        clearValue: { r: 0.0, g: 0.0, b: 0.0, a: 1.0 },
                        loadOp: 'clear',
                        storeOp: 'store',
                    },
                ],
            }
        ]

        const bgColorPassDescriptor: GPURenderPassDescriptor = {
            colorAttachments: [
                {
                    view: this.tmpOutputTextureView,
                    clearValue: { r: 0.0, g: 0.0, b: 0.0, a: 1.0 },
                    loadOp: 'clear',
                    storeOp: 'store',
                },
            ],
        }

        const fluidPassDescriptor: GPURenderPassDescriptor = {
            colorAttachments: [
                {
                    view: context.getCurrentTexture().createView(),
                    clearValue: { r: 0.0, g: 0.0, b: 0.0, a: 1.0 },
                    loadOp: 'clear',
                    storeOp: 'store',
                },
            ],
        }

        const depthMapPassDescriptor: GPURenderPassDescriptor = {
            colorAttachments: [
                {
                    view: this.depthMapTextureView,
                    clearValue: { r: 1e6, g: 0.0, b: 0.0, a: 1.0 }, 
                    loadOp: 'clear',
                    storeOp: 'store',
                },
            ],
            depthStencilAttachment: {
                view: this.depthTestTextureView,
                depthClearValue: 1.0,
                depthLoadOp: 'clear',
                depthStoreOp: 'store',
            },
        }

        const spherePassDescriptor: GPURenderPassDescriptor = {
            colorAttachments: [
                {
                    view: this.depthMapTextureView,
                    clearValue: { r: 1e6, g: 0.0, b: 0.0, a: 1.0 }, 
                    loadOp: 'clear',
                    storeOp: 'store',
                },
                {
                    view: this.tmpOutputTextureView,
                    loadOp: 'load',
                    storeOp: 'store',
                },
            ],
            depthStencilAttachment: {
                view: this.depthTestTextureView,
                depthClearValue: 1.0,
                depthLoadOp: 'clear',
                depthStoreOp: 'store',
            },
        }

        const densityRaymarchPassDescriptor: GPURenderPassDescriptor = {
            colorAttachments: [
                { 
                    view: context.getCurrentTexture().createView(),
                    clearValue: { r: 0.7, g: 0.7, b: 0.75, a: 1.0 },
                    loadOp: 'clear',
                    storeOp: 'store',
                },
            ],
        }

        if (!sphereRenderFl) {
            const depthMapPassEncoder = commandEncoder.beginRenderPass(depthMapPassDescriptor);
            depthMapPassEncoder.setBindGroup(0, this.depthMapBindGroup);
            depthMapPassEncoder.setPipeline(this.depthMapPipeline);
            depthMapPassEncoder.draw(6, numParticles);
            depthMapPassEncoder.end();
            for (var iter = 0; iter < 2; iter++) { // 1D
                const depthFilterPassEncoderX = commandEncoder.beginRenderPass(depthFilterPassDescriptors[0]);
                depthFilterPassEncoderX.setBindGroup(0, this.depthFilter1DBindGroups[0]);
                depthFilterPassEncoderX.setPipeline(this.depthFilter1DPipeline);
                depthFilterPassEncoderX.draw(6);
                depthFilterPassEncoderX.end();  
                const filterPassEncoderY = commandEncoder.beginRenderPass(depthFilterPassDescriptors[1]);
                filterPassEncoderY.setBindGroup(0, this.depthFilter1DBindGroups[1]);
                filterPassEncoderY.setPipeline(this.depthFilter1DPipeline);
                filterPassEncoderY.draw(6);
                filterPassEncoderY.end();  
            }
            // 2D
            const depthFilterPassEncoderX = commandEncoder.beginRenderPass(depthFilterPassDescriptors[0]);
            depthFilterPassEncoderX.setBindGroup(0, this.depthFilter2DBindGroups[0]);
            depthFilterPassEncoderX.setPipeline(this.depthFilter2DPipeline);
            depthFilterPassEncoderX.draw(6);
            depthFilterPassEncoderX.end();  
            const filterPassEncoderY = commandEncoder.beginRenderPass(depthFilterPassDescriptors[1]);
            filterPassEncoderY.setBindGroup(0, this.depthFilter2DBindGroups[1]);
            filterPassEncoderY.setPipeline(this.depthFilter2DPipeline);
            filterPassEncoderY.draw(6);
            filterPassEncoderY.end();

            const thicknessMapPassEncoder = commandEncoder.beginRenderPass(thicknessMapPassDescriptor);
            thicknessMapPassEncoder.setBindGroup(0, this.thicknessMapBindGroup);
            thicknessMapPassEncoder.setPipeline(this.thicknessMapPipeline);
            thicknessMapPassEncoder.draw(6, numParticles);
            thicknessMapPassEncoder.end();
            
            for (var iter = 0; iter < 1; iter++) { 
                const thicknessFilterPassEncoderX = commandEncoder.beginRenderPass(thicknessFilterPassDescriptors[0]);
                thicknessFilterPassEncoderX.setBindGroup(0, this.thicknessFilterBindGroups[0]);
                thicknessFilterPassEncoderX.setPipeline(this.thicknessFilterPipeline);
                thicknessFilterPassEncoderX.draw(6);
                thicknessFilterPassEncoderX.end(); 
                const thicknessFilterPassEncoderY = commandEncoder.beginRenderPass(thicknessFilterPassDescriptors[1]);
                thicknessFilterPassEncoderY.setBindGroup(0, this.thicknessFilterBindGroups[1]);
                thicknessFilterPassEncoderY.setPipeline(this.thicknessFilterPipeline);
                thicknessFilterPassEncoderY.draw(6);
                thicknessFilterPassEncoderY.end(); 
            }
            const bgColorPassEncoder = commandEncoder.beginRenderPass(bgColorPassDescriptor);
            bgColorPassEncoder.setBindGroup(0, this.bgColorBindGroup);
            bgColorPassEncoder.setPipeline(this.bgColorPipeline);
            bgColorPassEncoder.draw(6);
            bgColorPassEncoder.end();

            const fluidPassEncoder = commandEncoder.beginRenderPass(fluidPassDescriptor);
            fluidPassEncoder.setBindGroup(0, this.fluidBindGroup);
            fluidPassEncoder.setPipeline(this.fluidPipeline);
            fluidPassEncoder.draw(6);
            fluidPassEncoder.end();
        } else {
            const bgColorPassEncoder = commandEncoder.beginRenderPass(bgColorPassDescriptor);
            bgColorPassEncoder.setBindGroup(0, this.bgColorBindGroup);
            bgColorPassEncoder.setPipeline(this.bgColorPipeline);
            bgColorPassEncoder.draw(6);
            bgColorPassEncoder.end();
            const spherePassEncoder = commandEncoder.beginRenderPass(spherePassDescriptor);
            spherePassEncoder.setBindGroup(0, this.sphereBindGroup);
            spherePassEncoder.setPipeline(this.spherePipeline);
            spherePassEncoder.draw(6, numParticles);
            spherePassEncoder.end();
            const densityRaymarchPassEncoder = commandEncoder.beginRenderPass(densityRaymarchPassDescriptor);
            densityRaymarchPassEncoder.setBindGroup(0, this.densityRaymarchBindGroup);
            densityRaymarchPassEncoder.setPipeline(this.densityRaymarchPipeline);
            densityRaymarchPassEncoder.draw(6);
            densityRaymarchPassEncoder.end();
        }
    }
}