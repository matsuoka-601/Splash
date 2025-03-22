# Splash
**Splash** is a real-time fluid simulation with the following features.
- Smoother fluid surface thanks to **Narrow-Range Filter (PACMCGIT 2018)** by Truong and Yuksel.
- **Shadows using ray marching** through the density field (particle mode only)
- Improved simulation performance due to the reduced number of substeps
- More interaction 🌊 (see the demo video)

![Splash_ An Interactive Fluid Simulation in Browsers](https://github.com/user-attachments/assets/6ca3b430-3337-46c3-b378-c582b1dea5e9)

The simulation and rendering is implemented in WebGPU. The Simulation is based on an algorithm called **MLS-MPM (Moving Least Squared Material Point Method)** and the rendering is based on **Screen-Space Fluid Rendering**. For more detail, see [my article on Codrops](https://tympanus.net/codrops/2025/02/26/webgpu-fluid-simulations-high-performance-real-time-rendering/).
## Demo Video
[![demo video](http://img.youtube.com/vi/9C7DRSdh88g/0.jpg)](https://www.youtube.com/watch?v=9C7DRSdh88g)
## Narrow-Range Filter for Depth Smoothing
For rendering fluids, I have used a Bilateral Filter for depth smoothing in past two projects ([WebGPU-Ocean](https://github.com/matsuoka-601/webgpu-ocean) and [WaterBall](https://github.com/matsuoka-601/waterball)). The fluid surface obtained with a Bilateral Filter has a decent quality, but it can produce some visible artifacts.

To mitigate these artifacts, more sophisticated filters than Bilateral Filter have been proposed. The one I'm using for this project is a [Narrow-Range Filter (PACMCGIT 2018)](https://ttnghia.github.io/pdf/NarrowRangeFilter.pdf) by Troung and Yuksel. This filter aims to render a smoother and cleaner fluid surface compared to other filters, while maintaining real-time performance.
## Shadows Using Raymarching
## Single Simulation Substep
