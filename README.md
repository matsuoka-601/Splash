# Splash
**Splash** is a real-time fluid simulation with the following features.
- Smoother fluid surface thanks to **Narrow-Range Filter (i3D 2018)** by Truong et al.
- **Shadows using ray marching** through the density field (particle mode only)
- Improved simulation performance due to the reduced number of substeps
- More interaction🌊

![splash-demo](https://github.com/user-attachments/assets/6ca54747-59a0-41ea-abc7-5d320302512e)

The simulation and rendering is implemented in WebGPU. The Simulation is based on an algorithm called **MLS-MPM (Moving Least Squared Material Point Method)** and the rendering is based on **Screen-Space Fluid Rendering**. For more detail, see [my article on Codrops](https://tympanus.net/codrops/2025/02/26/webgpu-fluid-simulations-high-performance-real-time-rendering/).
## Narrow-Range Filter for Depth Smoothing
## Shadows using Raymarching
