@group(0) @binding(0) var envmapTexture: texture_cube<f32>;
@group(0) @binding(1) var<uniform> uniforms: RenderUniforms;
@group(0) @binding(2) var textureSampler: sampler;

struct RenderUniforms {
    texelSize: vec2f, 
    sphereSize: f32, 
    invProjectionMatrix: mat4x4f, 
    projectionMatrix: mat4x4f, 
    viewMatrix: mat4x4f, 
    invViewMatrix: mat4x4f, 
}

struct FragmentInput {
    @location(0) uv: vec2f,  
    @location(1) iuv: vec2f
}

fn computeViewPosFromUVDepth(texCoord: vec2f, depth: f32) -> vec3f {
    var ndc: vec4f = vec4f(texCoord.x * 2.0 - 1.0, 1.0 - 2.0 * texCoord.y, 0.0, 1.0);
    ndc.z = -uniforms.projectionMatrix[2].z + uniforms.projectionMatrix[3].z / depth;
    ndc.w = 1.0;

    var eye_pos: vec4f = uniforms.invProjectionMatrix * ndc;

    return eye_pos.xyz / eye_pos.w;
}

fn getCameraPosition() -> vec3f {
    return (uniforms.invViewMatrix * vec4(0, 0, 0, 1)).xyz;
}

fn rayPlaneIntersection(rayOrigin: vec3f, rayDir: vec3f) -> vec3f {
    // if (abs(rayDir.y) < 1e-6) {
    //     return vec3(0.0); // 交差しない場合
    // }

    let t = -rayOrigin.y / rayDir.y;
    return rayOrigin + t * rayDir;
}

@fragment
fn fs(input: FragmentInput) -> @location(0) vec4f {
    let cameraPos = getCameraPosition();
    let rayDirWorld = normalize((uniforms.invViewMatrix * vec4f(computeViewPosFromUVDepth(input.uv, 1.0), 0.)).xyz); // depth は適当
    let bgColor = textureSampleLevel(envmapTexture, textureSampler, rayDirWorld, 0.).rgb;
    if (abs(rayDirWorld.y) < 1e-6) { // y = 0 と交差しない
        return vec4f(bgColor, 1.);
    } 

    let t = -cameraPos.y / rayDirWorld.y;
    if (t < 0) {
        return vec4f(bgColor, 1.);
    }
    let rayHitPos = cameraPos + t * rayDirWorld;
    let gridSize = 16.0;
    let lineThickness = 0.2; 

    let isLineX = abs(fract(rayHitPos.x / gridSize - 0.5) - 0.5) < lineThickness / gridSize;
    let isLineZ = abs(fract(rayHitPos.z / gridSize - 0.5) - 0.5) < lineThickness / gridSize;
    let isLine = isLineX || isLineZ;

    let boardColor = vec3(0.6); 
    let lineColor = vec3(0.5); 
    var finalColor = select(boardColor, lineColor, isLine);
    finalColor = select(bgColor, finalColor, abs(rayHitPos.x) < 3e2 && abs(rayHitPos.z) < 3e2);
    return vec4f(finalColor, 1.);
}