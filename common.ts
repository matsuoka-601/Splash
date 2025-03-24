// shared between main.ts and camera.ts
export const renderUniformsValues = new ArrayBuffer(272);
export const renderUniformsViews = {
  texelSize: new Float32Array(renderUniformsValues, 0, 2),
  sphereSize: new Float32Array(renderUniformsValues, 8, 2),
  invProjectionMatrix: new Float32Array(renderUniformsValues, 16, 16),
  projectionMatrix: new Float32Array(renderUniformsValues, 80, 16),
  viewMatrix: new Float32Array(renderUniformsValues, 144, 16),
  invViewMatrix: new Float32Array(renderUniformsValues, 208, 16),
};
