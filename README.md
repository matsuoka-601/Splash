# waterball
Real-time fluid simulation on a sphere🌏 implemented in WebGPU. 

Works on your browsers which support WebGPU (Chrome, Edge etc. Safari is also supported when WebGPU feature flag is enabled).

[Try demo here!](https://waterball.netlify.app/)

![waterball-demo-2](https://github.com/user-attachments/assets/7e0ce578-8084-4205-87d2-d836de155a5e)

This is a follow-up project of [webgpu-ocean](https://github.com/matsuoka-601/webgpu-ocean) and has the following characteristics. 
- [**Moving Least Squares Material Point Method (MLS-MPM)**](https://yzhu.io/publication/mpmmls2018siggraph/paper.pdf) by Hu et al. is implemented for the simulation.
  - [nialltl's article](https://nialltl.neocities.org/articles/mpm_guide) helped a lot when implementing MLS-MPM. Huge thanks for them!
- **Screen-Space Fluid Rendering** described in [GDC 2010 slide](https://developer.download.nvidia.com/presentations/2010/gdc/Direct3D_Effects.pdf) is used for real-time rendering of the fluid.

## How to run
```
npm install
npm run serve
```
If you have trouble running the repo, feel free to open an issue.
