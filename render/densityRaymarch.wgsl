struct FragmentInput {
    @location(0) uv: vec2f,  
    @location(1) iuv: vec2f
}

struct RenderUniforms {
    texelSize: vec2f, 
    sphereSize: f32, 
    invProjectionMatrix: mat4x4f, 
    projectionMatrix: mat4x4f, 
    viewMatrix: mat4x4f, 
    invViewMatrix: mat4x4f, 
}

@group(0) @binding(0) var depthTexture: texture_2d<f32>;
@group(0) @binding(1) var densityGridTexture: texture_3d<f32>;
@group(0) @binding(2) var<uniform> uniforms: RenderUniforms;
@group(0) @binding(3) var<uniform> initBoxSize: vec3f;
@group(0) @binding(4) var textureSampler: sampler;
@group(0) @binding(5) var bgTexture: texture_2d<f32>;
@group(0) @binding(6) var<uniform> densityGridSize: vec3f;

fn computeViewPosFromUVDepth(texCoord: vec2f, depth: f32) -> vec3f {
    var ndc: vec4f = vec4f(texCoord.x * 2.0 - 1.0, 1.0 - 2.0 * texCoord.y, 0.0, 1.0);
    ndc.z = -uniforms.projectionMatrix[2].z + uniforms.projectionMatrix[3].z / depth;
    ndc.w = 1.0;

    var eye_pos: vec4f = uniforms.invProjectionMatrix * ndc;

    return eye_pos.xyz / eye_pos.w;
}

fn getViewPosFromTexCoord(texCoord: vec2f, iuv: vec2f) -> vec3f {
    var depth: f32 = abs(textureLoad(depthTexture, vec2u(iuv), 0).x);
    return computeViewPosFromUVDepth(texCoord, depth);
}

fn gamma(v: vec3f) -> vec3f {
    return pow(v, vec3(1.0 / 2.2));
}

@fragment
fn fs(input: FragmentInput) -> @location(0) vec4f {
    let depth: f32 = abs(textureLoad(depthTexture, vec2u(input.iuv), 0).r);
    if (depth >= 1e4) {
        let bgColor: vec3f = textureSampleLevel(bgTexture, textureSampler, input.uv, 0.0).rgb;
        return vec4f(bgColor, 0.);
    }

    let surfacePosView = computeViewPosFromUVDepth(input.uv, depth);
    let rayDirView = normalize(surfacePosView);
    var surfacePosWorld = (uniforms.invViewMatrix * vec4f(surfacePosView, 1.)).xyz;
    let rayDirWorld = (uniforms.invViewMatrix * vec4f(rayDirView, 0.)).xyz;

    var ddx: vec3f = getViewPosFromTexCoord(input.uv + vec2f(uniforms.texelSize.x, 0.), input.iuv + vec2f(1.0, 0.0)) - surfacePosView; 
    var ddy: vec3f = getViewPosFromTexCoord(input.uv + vec2f(0., uniforms.texelSize.y), input.iuv + vec2f(0.0, 1.0)) - surfacePosView; 
    let ddx2: vec3f = surfacePosView - getViewPosFromTexCoord(input.uv + vec2f(-uniforms.texelSize.x, 0.), input.iuv + vec2f(-1.0, 0.0));
    let ddy2: vec3f = surfacePosView - getViewPosFromTexCoord(input.uv + vec2f(0., -uniforms.texelSize.y), input.iuv + vec2f(0.0, -1.0));
    ddx = select(ddx, ddx2, abs(ddx.z) > abs(ddx2.z));
    ddy = select(ddy, ddy2, abs(ddy.z) > abs(ddy2.z));
    var normal: vec3f = -normalize(cross(ddx, ddy)); 
    var normalWorld: vec3f = (uniforms.invViewMatrix * vec4f(normal, 0.)).xyz; 

    var densitySum: f32 = 0.;
    var t: f32 = 0.;
    let stepSize: f32 = 0.6; 
    let densityScale: f32 = 0.2; 
    let lightDirWorld: vec3f = normalize(vec3f(0, 1, 0));

    surfacePosWorld += 1.5 * lightDirWorld; 
    for (var i = 0; i < 1000; i++) { 
        let posWorld = surfacePosWorld + t * lightDirWorld;
        if (any(posWorld <= vec3f(0.)) || any(posWorld >= initBoxSize - 1)) { 
            break;
        }
        let worldCoord: vec3f = posWorld / densityGridSize;
        let density: f32 = textureSampleLevel(densityGridTexture, textureSampler, worldCoord.zyx, 0.).r;
        densitySum += stepSize * density * densityScale;
        t += stepSize;
    }


    let speed = textureSampleLevel(bgTexture, textureSampler, input.uv, 0.0).r;
    let albedo: vec3f = vec3f(0, 70, 250) / 256.;

    let LdotN: f32 = 0.5 * dot(normalWorld, lightDirWorld) + 0.5;
    let shadow = exp(-1. * densitySum);

    let H: vec3f        = normalize(lightDirWorld - rayDirWorld);
    let specular: f32   = pow(max(0.0, dot(H, normalWorld)), 50.);
    let diffuse: f32 = max(dot(normalWorld, lightDirWorld), 0.);
    var finalColor = shadow * LdotN * albedo * 1. + 0.1 * diffuse * shadow + 0.3 * specular * shadow;

    return vec4f(gamma(finalColor), 1.); 
}