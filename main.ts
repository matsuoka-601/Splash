import { mat4 } from 'wgpu-matrix'

import { Camera } from './camera'
import { mlsmpmParticleStructSize, MLSMPMSimulator } from './mls-mpm/mls-mpm'
import { renderUniformsViews, renderUniformsValues, numParticlesMax } from './common'
import { FluidRenderer } from './render/fluidRender'

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

	// const { devicePixelRatio } = window
	// let devicePixelRatio  = 5.0;
	let devicePixelRatio  = 0.6;
	canvas.width = devicePixelRatio * canvas.clientWidth
	canvas.height = devicePixelRatio * canvas.clientHeight

	const presentationFormat = navigator.gpu.getPreferredCanvasFormat()

	context.configure({
		device,
		format: presentationFormat,
	})

	return { canvas, device, presentationFormat, context }
}

function sleep(ms: number): Promise<void> {
	return new Promise(resolve => setTimeout(resolve, ms));
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

	// uniform buffer を作る
	renderUniformsViews.texel_size.set([1.0 / canvas.width, 1.0 / canvas.height]);

	// storage buffer を作る
	const maxParticleStructSize = mlsmpmParticleStructSize
	const particleBuffer = device.createBuffer({
		label: 'particles buffer', 
		size: maxParticleStructSize * numParticlesMax, 
		usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
	})
	const posvelBuffer = device.createBuffer({
		label: 'position buffer', 
		size: 48 * numParticlesMax,  
		usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
	})
	const renderUniformBuffer = device.createBuffer({
		label: 'filter uniform buffer', 
		size: renderUniformsValues.byteLength, 
		usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
	})

	console.log("buffer allocating done")


	let mlsmpmNumParticleParams = [40000, 65000, 100000, 180000]
	let mlsmpmInitBoxSizes = [[35, 40, 60], [42, 45, 75], [45, 50, 90], [55, 55, 100]]
	let mlsmpmInitDistances = [38, 45, 50, 60]
	let mouseRadiuses = [10, 10, 12, 14]
	let stretchStrength = [0.5, 0.5, 0.5, 0.5]

	const canvasElement = document.getElementById("fluidCanvas") as HTMLCanvasElement;
	// シミュレーション，カメラの初期化
	const mlsmpmFov = 75 * Math.PI / 180
	const mlsmpmRadius = 0.7
	const mlsmpmDiameter = 2 * mlsmpmRadius
	const mlsmpmZoomRate = 0.7
	const depthMapTexture = device.createTexture({
		label: 'depth map texture', 
		size: [canvas.width, canvas.height, 1],
		usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
		format: 'r32float',
	});
	const depthMapTextureView = depthMapTexture.createView()
	const mlsmpmSimulator = new MLSMPMSimulator(particleBuffer, posvelBuffer, mlsmpmDiameter, device, renderUniformBuffer, depthMapTextureView, canvas)
	const mlsmpmRenderer = new FluidRenderer(device, canvas, presentationFormat, mlsmpmRadius, mlsmpmFov, posvelBuffer, renderUniformBuffer, 
		cubemapTextureView, depthMapTextureView, mlsmpmSimulator.restDensity)

	console.log("simulator initialization done")

	const camera = new Camera(canvasElement);

	// デバイスロストの監視
	let errorLog = document.getElementById('error-reason') as HTMLSpanElement;
	errorLog.textContent = "";
	device.lost.then(info => {
		const reason = info.reason ? `reason: ${info.reason}` : 'unknown reason';
		errorLog.textContent = reason;
	});

	let paramsIdx = -1
	let initBoxSize = [0, 0, 0]
	let realBoxSize = [0, 0, 0]

	const smallValue = document.getElementById("small-value") as HTMLSpanElement;
	const mediumValue = document.getElementById("medium-value") as HTMLSpanElement;
	const largeValue = document.getElementById("large-value") as HTMLSpanElement;
	const veryLargeValue = document.getElementById("very-large-value") as HTMLSpanElement;
	smallValue.textContent = "40,000"
	mediumValue.textContent = "65,000"
	largeValue.textContent = "100,000"
	veryLargeValue.textContent = "180,000"

	let sphereRenderFl = false
	let rotateFl = false
	let startFl = true
	let boxWidthRatio = 1.

	console.log("simulation start")
	async function frame() {
		const start = performance.now();

		const form = document.getElementById("number-button") as HTMLFormElement;
		const selectedValue = new FormData(form).get("options") as string;
		if (Number(selectedValue) != paramsIdx) {
			paramsIdx = Number(selectedValue)
			initBoxSize = mlsmpmInitBoxSizes[paramsIdx]
			mlsmpmSimulator.reset(initBoxSize, mlsmpmNumParticleParams[paramsIdx])
			camera.reset(mlsmpmInitDistances[paramsIdx], [initBoxSize[0] / 2, initBoxSize[1] / 2, initBoxSize[2] / 2], 
				mlsmpmFov, mlsmpmZoomRate)
			realBoxSize = [...initBoxSize]
			let slider = document.getElementById("slider") as HTMLInputElement
			slider.value = "100"
		}

		const slider = document.getElementById("slider") as HTMLInputElement
		const particle = document.getElementById("particle") as HTMLInputElement
		sphereRenderFl = particle.checked
		let curBoxWidthRatio = parseInt(slider.value) / 200 + 0.5
		const minClosingSpeed = -0.008
		let dVal = Math.max(curBoxWidthRatio - boxWidthRatio, minClosingSpeed)
		boxWidthRatio += dVal

		// 行列の更新
		realBoxSize[2] = initBoxSize[2] * boxWidthRatio
		mlsmpmSimulator.changeBoxSize(realBoxSize)
		device.queue.writeBuffer(renderUniformBuffer, 0, renderUniformsValues) 

		const commandEncoder = device.createCommandEncoder()

		// 計算のためのパス
		mlsmpmSimulator.execute(commandEncoder, 
				[camera.currentHoverX / canvas.clientWidth, camera.currentHoverY / canvas.clientHeight], 
				camera.calcMouseVelocity(), mouseRadiuses[paramsIdx])
		mlsmpmRenderer.execute(context, commandEncoder, mlsmpmSimulator.numParticles, sphereRenderFl, stretchStrength[paramsIdx])

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

