import depthFilter from './bilateral.wgsl'
import fluid from './fluid.wgsl'
import fullScreen from './fullScreen.wgsl'
import thicknessMap from './thicknessMap.wgsl'
import gaussian from './gaussian.wgsl'
import depthMap from './depthMap.wgsl'
import sphere from './sphere.wgsl'


export class FluidRenderer {
    depthFilterPipeline: GPURenderPipeline
    thicknessMapPipeline: GPURenderPipeline
    thicknessFilterPipeline: GPURenderPipeline
    splashFilterPipeline: GPURenderPipeline
    fluidPipeline: GPURenderPipeline
    depthMapPipeline: GPURenderPipeline
    spherePipeline: GPURenderPipeline

    depthMapTextureView: GPUTextureView
    splashTextureView: GPUTextureView
    tmpDepthMapTextureView: GPUTextureView
    thicknessTextureView: GPUTextureView
    tmpThicknessTextureView: GPUTextureView
    tmpSplashTextureView: GPUTextureView
    depthTestTextureView: GPUTextureView

    
    depthFilterBindGroups: GPUBindGroup[]
    thicknessMapBindGroup: GPUBindGroup
    thicknessFilterBindGroups: GPUBindGroup[]
    splashFilterBindGroups: GPUBindGroup[]
    fluidBindGroup: GPUBindGroup
    depthMapBindGroup: GPUBindGroup
    sphereBindGroup: GPUBindGroup

    stretchStrengthBuffer: GPUBuffer

    device: GPUDevice

    constructor(
        device: GPUDevice, canvas: HTMLCanvasElement, presentationFormat: GPUTextureFormat,
        radius: number, fov: number, posvelBuffer: GPUBuffer, 
        renderUniformBuffer: GPUBuffer, cubemapTextureView: GPUTextureView, depthMapTextureView: GPUTextureView, 
        restDensity: number
    ) {
        this.device = device
        const maxFilterSize = 100
        const blurdDepthScale = 10
        const diameter = 2 * radius
        const blurFilterSize = 12

        const screenConstants = {
            'screenHeight': canvas.height, 
            'screenWidth': canvas.width, 
        }
        const filterConstants = {
            'depthThreshold' : radius * blurdDepthScale, 
            'maxFilterSize' : maxFilterSize, 
            'projectedParticleConstant' : (blurFilterSize * diameter * 0.05 * (canvas.height / 2)) / Math.tan(fov / 2), 
        }
        const renderEffectConstants = {
            'restDensity' : restDensity, 
            'densitySizeScale' : 1.5, 
        }
        const sampler = device.createSampler({
            addressModeU: "repeat",
            addressModeV: "repeat",
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

        // pipelines
        this.depthMapPipeline = device.createRenderPipeline({
            label: 'depthMap pipeline', 
            layout: 'auto', 
            vertex: { module: depthMapModule, constants: renderEffectConstants }, 
            fragment: {
                module: depthMapModule, 
                targets: [
                    {
                        format: 'r32float',
                    },
                    {
                        format: 'r32float', 
                    }
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
            vertex: { module: sphereModule, constants: renderEffectConstants }, 
            fragment: {
                module: sphereModule, 
                targets: [
                    {
                        format: presentationFormat, 
                    }, 
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
        this.depthFilterPipeline = device.createRenderPipeline({
            label: 'filter pipeline', 
            layout: 'auto', 
            vertex: { 
                module: vertexModule,  
                constants: screenConstants
            },
            fragment: {
                module: depthFilterModule, 
                constants: filterConstants, 
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
                constants: renderEffectConstants,  
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
        this.splashFilterPipeline = device.createRenderPipeline({
            label: 'splash filter pipeline', 
            layout: 'auto', 
            vertex: { 
                module: vertexModule,  
                constants: screenConstants
            },
            fragment: {
                module: thicknessFilterModule,
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

        // textures
        const tmpDepthMapTexture = device.createTexture({ 
            label: 'temporary depth map texture', 
            size: [canvas.width, canvas.height, 1],
            usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
            format: 'r32float',
        });
        const thicknessTexture = device.createTexture({
            label: 'thickness map texture', 
            size: [canvas.width, canvas.height, 1],
            usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
            format: 'r16float',
        });
        const splashTexture = device.createTexture({
            label: 'splash texture', 
            size: [canvas.width, canvas.height, 1],
            usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
            format: 'r32float',
        })
        const tmpThicknessTexture = device.createTexture({
            label: 'temporary thickness map texture', 
            size: [canvas.width, canvas.height, 1],
            usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
            format: 'r16float',
        });
        const tmpSplashTexture = device.createTexture({
            label: 'temporary splash texture', 
            size: [canvas.width, canvas.height, 1],
            usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
            format: 'r32float',
        });
        const depthTestTexture = device.createTexture({
            size: [canvas.width, canvas.height, 1],
            format: 'depth32float',
            usage: GPUTextureUsage.RENDER_ATTACHMENT,
        })
        this.depthMapTextureView = depthMapTextureView
        this.splashTextureView = splashTexture.createView()
        this.tmpDepthMapTextureView = tmpDepthMapTexture.createView()
        this.thicknessTextureView = thicknessTexture.createView()
        this.tmpThicknessTextureView = tmpThicknessTexture.createView()
        this.tmpSplashTextureView = tmpSplashTexture.createView()
        this.depthTestTextureView = depthTestTexture.createView()

        // buffer
        const filterXUniformsValues = new ArrayBuffer(8)
        const filterYUniformsValues = new ArrayBuffer(8)
        const thicknessFilterSizeValues = new ArrayBuffer(4);
        const splashFilterSizeValues = new ArrayBuffer(4);
        const timeValues = new ArrayBuffer(4)
        const filterXUniformsViews = new Float32Array(filterXUniformsValues)
        const filterYUniformsViews = new Float32Array(filterYUniformsValues) 
        const thicknessFilterSizeViews = new Int32Array(thicknessFilterSizeValues) 
        const splashFilterSizeViews = new Int32Array(splashFilterSizeValues) 
        filterXUniformsViews.set([1.0, 0.0])
        filterYUniformsViews.set([0.0, 1.0])
        thicknessFilterSizeViews.set([15])
        let splashFilterSize = Math.max(0.2 * diameter * 0.05 * (canvas.height / 2) / Math.tan(fov / 2), 2);
        console.log(splashFilterSize)
        splashFilterSizeViews.set([splashFilterSize])
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
        const splashFilterSizeBuffer = device.createBuffer({
            label: 'splash filter size buffer', 
            size: splashFilterSizeValues.byteLength, 
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        })
        this.stretchStrengthBuffer = device.createBuffer({
            label: 'stretch strength buffer', 
            size: 4, 
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        })
        device.queue.writeBuffer(filterXUniformBuffer, 0, filterXUniformsValues);
        device.queue.writeBuffer(filterYUniformBuffer, 0, filterYUniformsValues);
        device.queue.writeBuffer(thicknessFilterSizeBuffer, 0, thicknessFilterSizeValues);
        device.queue.writeBuffer(splashFilterSizeBuffer, 0, splashFilterSizeValues);

        // bindGroup
        this.depthFilterBindGroups = []
        this.depthFilterBindGroups = [
            device.createBindGroup({
                label: 'filterX bind group', 
                layout: this.depthFilterPipeline.getBindGroupLayout(0),
                entries: [
                    // { binding: 0, resource: sampler },
                    { binding: 1, resource: this.depthMapTextureView }, // 元の領域から読み込む
                    { binding: 2, resource: { buffer: filterXUniformBuffer } },
                ],
            }), 
            device.createBindGroup({
                label: 'filterY bind group', 
                layout: this.depthFilterPipeline.getBindGroupLayout(0),
                entries: [
                    // { binding: 0, resource: sampler },
                    { binding: 1, resource: this.tmpDepthMapTextureView }, // 一時領域から読み込む
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
                { binding: 2, resource: { buffer: this.stretchStrengthBuffer }}
            ],
        })
        this.thicknessFilterBindGroups = []
        this.thicknessFilterBindGroups = [
            device.createBindGroup({
                label: 'thickness filterX bind group', 
                layout: this.thicknessFilterPipeline.getBindGroupLayout(0),
                entries: [
                    // { binding: 0, resource: sampler },
                    { binding: 1, resource: this.thicknessTextureView }, 
                    { binding: 2, resource: { buffer: filterXUniformBuffer } }, 
                    { binding: 3, resource: { buffer: thicknessFilterSizeBuffer }}
                ],
            }), 
            device.createBindGroup({
                label: 'thickness filterY bind group', 
                layout: this.thicknessFilterPipeline.getBindGroupLayout(0),
                entries: [
                    // { binding: 0, resource: sampler },
                    { binding: 1, resource: this.tmpThicknessTextureView }, 
                    { binding: 2, resource: { buffer: filterYUniformBuffer } }, 
                    { binding: 3, resource: { buffer: thicknessFilterSizeBuffer }}
                ],
            }), 
        ]

        this.splashFilterBindGroups = []
        this.splashFilterBindGroups = [
            device.createBindGroup({
                label: 'splash filterX bind group', 
                layout: this.splashFilterPipeline.getBindGroupLayout(0),
                entries: [
                    // { binding: 0, resource: sampler },
                    { binding: 1, resource: this.splashTextureView }, 
                    { binding: 2, resource: { buffer: filterXUniformBuffer } }, 
                    { binding: 3, resource: { buffer: splashFilterSizeBuffer }}
                ],
            }), 
            device.createBindGroup({
                label: 'splash filterY bind group', 
                layout: this.splashFilterPipeline.getBindGroupLayout(0),
                entries: [
                    // { binding: 0, resource: sampler },
                    { binding: 1, resource: this.tmpSplashTextureView }, 
                    { binding: 2, resource: { buffer: filterYUniformBuffer } }, 
                    { binding: 3, resource: { buffer: splashFilterSizeBuffer }}
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
              { binding: 5, resource: this.splashTextureView }, 
            ],
        })

        this.depthMapBindGroup = device.createBindGroup({
            label: 'depthMap bind group', 
            layout: this.depthMapPipeline.getBindGroupLayout(0),  
            entries: [
                { binding: 0, resource: { buffer: posvelBuffer }},
                { binding: 1, resource: { buffer: renderUniformBuffer }},
                { binding: 2, resource: { buffer: this.stretchStrengthBuffer }}, 
            ]
        })

        this.sphereBindGroup = device.createBindGroup({
            label: 'sphere bind group', 
            layout: this.spherePipeline.getBindGroupLayout(0),  
            entries: [
                { binding: 0, resource: { buffer: posvelBuffer }},
                { binding: 1, resource: { buffer: renderUniformBuffer }},
                { binding: 2, resource: { buffer: this.stretchStrengthBuffer }}, 
            ]
        })
    }


    execute(context: GPUCanvasContext, commandEncoder: GPUCommandEncoder, 
        numParticles: number, sphereRenderFl: boolean, stretchStrength: number) 
    {
        const stretchStrengthValues = new ArrayBuffer(4)
        const timeValues = new ArrayBuffer(4)
        const stretchStrengthViews = new Float32Array(stretchStrengthValues)
        const timeViews = new Float32Array(timeValues)
        stretchStrengthViews.set([stretchStrength])
        this.device.queue.writeBuffer(this.stretchStrengthBuffer, 0, stretchStrengthViews)

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
                        view: this.tmpThicknessTextureView, // 一時領域へ書き込み
                        clearValue: { r: 0.0, g: 0.0, b: 0.0, a: 1.0 },
                        loadOp: 'clear',
                        storeOp: 'store',
                    },
                ],
            }, 
            {
                colorAttachments: [
                    {
                        view: this.thicknessTextureView, // Y のパスはもとに戻す
                        clearValue: { r: 0.0, g: 0.0, b: 0.0, a: 1.0 },
                        loadOp: 'clear',
                        storeOp: 'store',
                    },
                ],
            }
        ]
        const splashFilterPassDescriptors: GPURenderPassDescriptor[] = [
            {
                colorAttachments: [
                    {
                        view: this.tmpSplashTextureView, // 一時領域へ書き込み
                        clearValue: { r: 0.0, g: 0.0, b: 0.0, a: 1.0 },
                        loadOp: 'clear',
                        storeOp: 'store',
                    },
                ],
            }, 
            {
                colorAttachments: [
                    {
                        view: this.splashTextureView, // Y のパスはもとに戻す
                        clearValue: { r: 0.0, g: 0.0, b: 0.0, a: 1.0 },
                        loadOp: 'clear',
                        storeOp: 'store',
                    },
                ],
            }
        ]

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
                    clearValue: { r: 1e6, g: 0.0, b: 0.0, a: 1.0 }, // 背景は十分大きい深さの値でいいか？
                    loadOp: 'clear',
                    storeOp: 'store',
                },
                {
                    view: this.splashTextureView,
                    clearValue: { r: 0.0, g: 0.0, b: 0.0, a: 1.0 }, // 背景は十分大きい深さの値でいいか？
                    loadOp: 'clear',
                    storeOp: 'store',
                }
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
                    view: context.getCurrentTexture().createView(),
                    clearValue: { r: 0.7, g: 0.7, b: 0.75, a: 1.0 },
                    loadOp: 'clear',
                    storeOp: 'store',
                },
                {
                    view: this.depthMapTextureView,
                    clearValue: { r: 1e6, g: 0.0, b: 0.0, a: 1.0 }, // 背景は十分大きい深さの値でいいか？
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

        if (!sphereRenderFl) {
            const depthMapPassEncoder = commandEncoder.beginRenderPass(depthMapPassDescriptor);
            depthMapPassEncoder.setBindGroup(0, this.depthMapBindGroup);
            depthMapPassEncoder.setPipeline(this.depthMapPipeline);
            depthMapPassEncoder.draw(6, numParticles);
            depthMapPassEncoder.end();
            for (var iter = 0; iter < 4; iter++) {
                const depthFilterPassEncoderX = commandEncoder.beginRenderPass(depthFilterPassDescriptors[0]);
                depthFilterPassEncoderX.setBindGroup(0, this.depthFilterBindGroups[0]);
                depthFilterPassEncoderX.setPipeline(this.depthFilterPipeline);
                depthFilterPassEncoderX.draw(6);
                depthFilterPassEncoderX.end();  
                const filterPassEncoderY = commandEncoder.beginRenderPass(depthFilterPassDescriptors[1]);
                filterPassEncoderY.setBindGroup(0, this.depthFilterBindGroups[1]);
                filterPassEncoderY.setPipeline(this.depthFilterPipeline);
                filterPassEncoderY.draw(6);
                filterPassEncoderY.end();  
            }
            const thicknessMapPassEncoder = commandEncoder.beginRenderPass(thicknessMapPassDescriptor);
            thicknessMapPassEncoder.setBindGroup(0, this.thicknessMapBindGroup);
            thicknessMapPassEncoder.setPipeline(this.thicknessMapPipeline);
            thicknessMapPassEncoder.draw(6, numParticles);
            thicknessMapPassEncoder.end();
            
        
            for (var iter = 0; iter < 1; iter++) { // 多いか？
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

            for (var iter = 0; iter < 3; iter++) {
                const splashFilterPassEncoderX = commandEncoder.beginRenderPass(splashFilterPassDescriptors[0]);
                splashFilterPassEncoderX.setBindGroup(0, this.splashFilterBindGroups[0]);
                splashFilterPassEncoderX.setPipeline(this.splashFilterPipeline);
                splashFilterPassEncoderX.draw(6);
                splashFilterPassEncoderX.end(); 
                const splashFilterPassEncoderY = commandEncoder.beginRenderPass(splashFilterPassDescriptors[1]);
                splashFilterPassEncoderY.setBindGroup(0, this.splashFilterBindGroups[1]);
                splashFilterPassEncoderY.setPipeline(this.splashFilterPipeline);
                splashFilterPassEncoderY.draw(6);
                splashFilterPassEncoderY.end(); 
            }


            const fluidPassEncoder = commandEncoder.beginRenderPass(fluidPassDescriptor);
            fluidPassEncoder.setBindGroup(0, this.fluidBindGroup);
            fluidPassEncoder.setPipeline(this.fluidPipeline);
            fluidPassEncoder.draw(6);
            fluidPassEncoder.end();
        } else {
            const spherePassEncoder = commandEncoder.beginRenderPass(spherePassDescriptor);
            spherePassEncoder.setBindGroup(0, this.sphereBindGroup);
            spherePassEncoder.setPipeline(this.spherePipeline);
            spherePassEncoder.draw(6, numParticles);
            spherePassEncoder.end();
        }
    }
}