# Splash
**Splash** is a real-time fluid simulation with the following features.
- Smoother fluid surface thanks to **Narrow-Range Filter (i3D 2018)** by Truong et al.
- **Shadows using ray marching** through the density field (particle mode only)
- Improved simulation performance due to the reduced number of substeps
- More interaction🌊

![Splash_ An Interactive Fluid Simulation in Browsers](https://github.com/user-attachments/assets/6ca3b430-3337-46c3-b378-c582b1dea5e9)

The simulation and rendering is implemented in WebGPU. The Simulation is based on an algorithm called **MLS-MPM (Moving Least Squared Material Point Method)** and the rendering is based on **Screen-Space Fluid Rendering**. For more detail, see [my article on Codrops](https://tympanus.net/codrops/2025/02/26/webgpu-fluid-simulations-high-performance-real-time-rendering/).
## Demo Video
[![demo video](http://img.youtube.com/vi/9C7DRSdh88g/0.jpg)](https://www.youtube.com/watch?v=9C7DRSdh88g)
## Narrow-Range Filter for Depth Smoothing
## Shadows Using Raymarching
## Single Simulation Substep
