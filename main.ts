import { Camera } from './camera'
import { mlsmpmParticleStructSize, MLSMPMSimulator } from './mls-mpm/mls-mpm'
import { renderUniformsViews, renderUniformsValues, numParticlesMax } from './common'
import { FluidRenderer } from './render/fluidRender'
import GUI from 'lil-gui';

/// <reference types="@webgpu/types" />


async function init() {
	const canvas: HTMLCanvasElement = document.querySelector('canvas')!

	if (!navigator.gpu) {
		alert("WebGPU is not supported on your browser.");
		throw new Error()
	}

	const adapter = await navigator.gpu.requestAdapter()

	if (!adapter) {
		alert("Adapter is not available.");
		throw new Error()
	}

	const device = await adapter.requestDevice()

	const context = canvas.getContext('webgpu') as GPUCanvasContext

	if (!context) {
		throw new Error()	
	}

	let devicePixelRatio  = 0.7;
	canvas.width = devicePixelRatio * canvas.clientWidth
	canvas.height = devicePixelRatio * canvas.clientHeight

	console.log(canvas.width, canvas.height)

	const presentationFormat = navigator.gpu.getPreferredCanvasFormat()

	context.configure({
		device,
		format: presentationFormat,
	})

	return { canvas, device, presentationFormat, context }
}

async function main() {
	const { canvas, device, presentationFormat, context } = await init();
	
	console.log("initialization done")

	context.configure({
		device,
		format: presentationFormat,
	})

	let cubemapTexture: GPUTexture;
	{
		// The order of the array layers is [+X, -X, +Y, -Y, +Z, -Z]
		const imgSrcs = [
			'cubemap/posx.png',
			'cubemap/negx.png',
			'cubemap/posy.png',
			'cubemap/negy.png',
			'cubemap/posz.png',
			'cubemap/negz.png',
		];
		const promises = imgSrcs.map(async (src) => {
			const response = await fetch(src);
			return createImageBitmap(await response.blob());
		});
		const imageBitmaps = await Promise.all(promises);

		cubemapTexture = device.createTexture({
			dimension: '2d',
			// Create a 2d array texture.
			// Assume each image has the same size.
			size: [imageBitmaps[0].width, imageBitmaps[0].height, 6],
			format: 'rgba8unorm',
			usage:
			GPUTextureUsage.TEXTURE_BINDING |
			GPUTextureUsage.COPY_DST |
			GPUTextureUsage.RENDER_ATTACHMENT,
		});

		for (let i = 0; i < imageBitmaps.length; i++) {
			const imageBitmap = imageBitmaps[i];
			device.queue.copyExternalImageToTexture(
				{ source: imageBitmap },
				{ texture: cubemapTexture, origin: [0, 0, i] },
				[imageBitmap.width, imageBitmap.height]
			);
		}
	}

	const cubemapTextureView = cubemapTexture.createView({
		dimension: 'cube',
	});
	console.log("cubemap initialization done")


	const gui = new GUI();

	const numParticlesOptions = [
		'Small (40,000 particles)', 
		'Medium (70,000 particles)', 
		'Large (100,000 particles)', 
		'Very Large (180,000 particles)'
	]

	const params = {
		sigma: 1.3,
		running: true,
		r: 140, 
		g:220, 
		b:240,  
		speed: 0.8, 
		colorDensity: 3., 
		numParticles: numParticlesOptions[1], 
		toggleSimulation: () => {
			params.running = !params.running;
		}
	};	

	const numParticlesFolder = gui.addFolder('Number of Particles');
	numParticlesFolder.add(params, 'numParticles', numParticlesOptions)
  		.name('Number of Particles')
	const speedFolder = gui.addFolder('Speed');
	speedFolder.add(params, 'speed', 0.3, 1.0, 0.1).name('Simlation Speed')
	const colorFolder = gui.addFolder('Diffuse Color');
	colorFolder.add(params, 'r', 0, 255, 1).name('R')
	colorFolder.add(params, 'g', 0, 255, 1).name('G')
	colorFolder.add(params, 'b', 0, 255, 1).name('B')
	colorFolder.add(params, 'colorDensity', 0.0, 6.0, 0.1).name('Density')
	colorFolder.close();

	document.addEventListener('keydown', (event) => {
		if (event.code === 'KeyP') { 
		  params.toggleSimulation(); 
		}
	});


	renderUniformsViews.texel_size.set([1.0 / canvas.width, 1.0 / canvas.height]);

	// シミュレーションとレンダリングで使いまわすバッファ
	const maxParticleStructSize = mlsmpmParticleStructSize
	const maxGridCount = 140 * 140 * 140;
	const particleBuffer = device.createBuffer({
		label: 'particles buffer', 
		size: maxParticleStructSize * numParticlesMax, 
		usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
	})
	const densityGridBuffer = device.createBuffer({
		label: 'density grid buffer', 
		size: 4 * maxGridCount, 
		usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
	})
	const posvelBuffer = device.createBuffer({
		label: 'posvel buffer', 
		size: 32 * numParticlesMax,  
		usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
	})
	const renderUniformBuffer = device.createBuffer({
		label: 'filter uniform buffer', 
		size: renderUniformsValues.byteLength, 
		usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
	})
	const initBoxSizeBuffer = device.createBuffer({
		label: 'init box size buffer', 
		size: 12,  // vec3f
		usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
	})

	console.log("buffer allocating done")


	let mlsmpmNumParticleParams = [40000, 70000, 100000, 180000]
	let mlsmpmInitBoxSizes = [[60, 50, 60], [70, 50, 70], [80, 70, 80], [90, 60, 90]]
	let mlsmpmInitDistances = [50, 60, 70, 75]
	let mouseRadiuses = [15, 15, 15, 18]
	let cameraTargetY = [10, 12, 12, 15]

	const canvasElement = document.getElementById("fluidCanvas") as HTMLCanvasElement;
	// シミュレーション，カメラの初期化
	const mlsmpmFov = 60 * Math.PI / 180
	const mlsmpmRadius = 0.6
	const mlsmpmDiameter = 2 * mlsmpmRadius
	const mlsmpmZoomRate = 0.7
	const fixedPointMultiplier = 1e7
	const depthMapTexture = device.createTexture({
		label: 'depth map texture', 
		size: [canvas.width, canvas.height, 1],
		usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
		format: 'r32float',
	});
	const depthMapTextureView = depthMapTexture.createView()
	const mlsmpmSimulator = new MLSMPMSimulator(particleBuffer, posvelBuffer, mlsmpmDiameter, device, renderUniformBuffer, depthMapTextureView, canvas, maxGridCount, densityGridBuffer, initBoxSizeBuffer, fixedPointMultiplier)
	const mlsmpmRenderer = new FluidRenderer(device, canvas, presentationFormat, mlsmpmRadius, mlsmpmFov, posvelBuffer, renderUniformBuffer,  cubemapTextureView, depthMapTextureView, densityGridBuffer, fixedPointMultiplier, initBoxSizeBuffer)

	console.log("simulator initialization done")

	const camera = new Camera(canvasElement)

	// デバイスロストの監視
	let errorLog = document.getElementById('error-reason') as HTMLSpanElement
	errorLog.textContent = ""
	device.lost.then(info => {
		const reason = info.reason ? `reason: ${info.reason}` : 'unknown reason';
		errorLog.textContent = reason;
	});

	let paramsIdx = -1
	let initBoxSize = [0, 0, 0]
	let realBoxSize = [0, 0, 0]

	let sphereRenderFl = false
	let rotateFl = false
	let boxWidthRatio = 1.

	console.log("simulation start")
	let closingSpeed = 0.
	let prevClosingSpeed = 0.
	async function frame() {
		const start = performance.now();

		const form = document.getElementById("number-button") as HTMLFormElement;
		const selectedValue = numParticlesOptions.indexOf(params.numParticles);
		if (params.running && Number(selectedValue) != paramsIdx) {
			paramsIdx = Number(selectedValue)
			initBoxSize = mlsmpmInitBoxSizes[paramsIdx]
			mlsmpmSimulator.reset(initBoxSize, mlsmpmNumParticleParams[paramsIdx])
			camera.reset(mlsmpmInitDistances[paramsIdx], [initBoxSize[0] / 2, cameraTargetY[paramsIdx], initBoxSize[2] / 2], 
				mlsmpmFov, mlsmpmZoomRate)
			realBoxSize = [...initBoxSize]
			let slider = document.getElementById("slider") as HTMLInputElement
			slider.value = "100"
		}

		const particle = document.getElementById("particle") as HTMLInputElement
		sphereRenderFl = particle.checked
		if (params.running) {
			const slider = document.getElementById("slider") as HTMLInputElement
			let curBoxWidthRatio = parseInt(slider.value) / 200 + 0.5
			const maxClosingSpeed = 0.007 * params.speed
			closingSpeed = Math.min(maxClosingSpeed, prevClosingSpeed + maxClosingSpeed / 40.)
			let dVal = Math.min(boxWidthRatio - curBoxWidthRatio, closingSpeed)
			boxWidthRatio -= dVal
			if (dVal <= 0.) {
				closingSpeed = 0.
				prevClosingSpeed = 0.
			} else {
				prevClosingSpeed = closingSpeed
			}	
		}


		realBoxSize[2] = initBoxSize[2] * boxWidthRatio
		mlsmpmSimulator.changeBoxSize(realBoxSize)
		device.queue.writeBuffer(renderUniformBuffer, 0, renderUniformsValues) 

		const commandEncoder = device.createCommandEncoder()

		let maxDt = 0.4;
		mlsmpmSimulator.execute(commandEncoder, 
			[camera.currentHoverX / canvas.clientWidth, camera.currentHoverY / canvas.clientHeight], 
			camera.calcMouseVelocity(), mouseRadiuses[paramsIdx], sphereRenderFl, maxDt * params.speed, params.running)	
		let normalizedDiffuseColor = [params.r / 255, params.g / 255, params.b / 255];
		mlsmpmRenderer.execute(context, commandEncoder, mlsmpmSimulator.numParticles, sphereRenderFl, normalizedDiffuseColor, params.colorDensity)

		device.queue.submit([commandEncoder.finish()])

		camera.setNewPrevMouseCoord();
		if (rotateFl) {
			camera.stepAngle();
		}

		const end = performance.now();

		requestAnimationFrame(frame)
	} 
	requestAnimationFrame(frame)
}

main()

