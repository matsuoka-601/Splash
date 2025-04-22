struct Cell {
    vx: i32, 
    vy: i32, 
    vz: i32, 
    mass: i32, 
}
struct RenderUniforms {
    texelSize: vec2f, 
    sphereSize: f32, 
    invProjectionMatrix: mat4x4f, 
    projectionMatrix: mat4x4f, 
    viewMatrix: mat4x4f, 
    invViewMatrix: mat4x4f, 
}
struct MouseInfo {
    screenSize: vec2f, 
    mouseCoord : vec2f, 
    mouseVel : vec2f, 
    mouseRadius: f32, 
}

override fixedPointMultiplier: f32; 
override fixedPointMultiplierInverse: f32; 

@group(0) @binding(0) var<storage, read_write> cells: array<Cell>;
@group(0) @binding(1) var<uniform> realBoxSize: vec3f;
@group(0) @binding(2) var<uniform> initBoxSize: vec3f;
@group(0) @binding(3) var<uniform> uniforms: RenderUniforms;
@group(0) @binding(4) var depthTexture: texture_2d<f32>;
@group(0) @binding(5) var<uniform> mouseInfo: MouseInfo; 
@group(0) @binding(6) var<uniform> dt: f32; 

fn encodeFixedPoint(floatingPoint: f32) -> i32 {
	return i32(floatingPoint * fixedPointMultiplier);
}
fn decodeFixedPoint(fixedPoint: i32) -> f32 {
	return f32(fixedPoint) * fixedPointMultiplierInverse;
}

fn computeViewPosFromUVDepth(tex_coord: vec2f, depth: f32) -> vec3f {
    var ndc: vec4f = vec4f(tex_coord.x * 2.0 - 1.0, 1.0 - 2.0 * tex_coord.y, 0.0, 1.0);
    ndc.z = -uniforms.projectionMatrix[2].z + uniforms.projectionMatrix[3].z / depth;
    ndc.w = 1.0;

    var eye_pos: vec4f = uniforms.invProjectionMatrix * ndc;

    return eye_pos.xyz / eye_pos.w;
}

fn getViewPosFromTexCoord(tex_coord: vec2f, iuv: vec2f) -> vec3f {
    var depth: f32 = abs(textureLoad(depthTexture, vec2u(iuv), 0).x);
    return computeViewPosFromUVDepth(tex_coord, depth);
}

@compute @workgroup_size(64)
fn updateGrid(@builtin(global_invocation_id) id: vec3<u32>) {
    if (id.x < arrayLength(&cells)) { // TODO : 変える
        let uv: vec2f = mouseInfo.mouseCoord;
        let iuv = uv * mouseInfo.screenSize;
        let depth: f32 = abs(textureLoad(depthTexture, vec2u(iuv), 0).x);
        var mouseCellIndex: u32 = 1000000000; // 適当な invalid 値
        var cellSquareDistToMouse: f32 = 1e9;
        var forceDir = vec3f(0.);

        if (depth < 1e4) {
            let mouseViewPos = getViewPosFromTexCoord(uv, iuv);
            let mouseWorldPos = uniforms.invViewMatrix * vec4f(mouseViewPos, 1.); // 位置なので 1
            let mouseCellPos: vec3i = vec3i(floor(mouseWorldPos).xyz);
            mouseCellIndex =    u32(mouseCellPos.x) * u32(initBoxSize.y) * u32(initBoxSize.z) + 
                                u32(mouseCellPos.y) * u32(initBoxSize.z) + 
                                u32(mouseCellPos.z);
            let center = realBoxSize / 2;
            forceDir = select(vec3f(0.), (uniforms.invViewMatrix * vec4f(mouseInfo.mouseVel, 0.0, 0)).xyz, dot(mouseInfo.mouseVel, mouseInfo.mouseVel) > 0.);
            var x: f32 = f32(i32(id.x) / i32(initBoxSize.z) / i32(initBoxSize.y));
            var y: f32 = f32((i32(id.x) / i32(initBoxSize.z)) % i32(initBoxSize.y));
            var z: f32 = f32(i32(id.x) % i32(initBoxSize.z));
            let cellPos = vec3f(x, y, z);
            let diff = floor(mouseWorldPos).xyz - cellPos;
            cellSquareDistToMouse = dot(diff, diff);
        }

        let dt = dt;
        let r = mouseInfo.mouseRadius;

        if (cells[id.x].mass > 0) { // 0 との比較は普通にしてよい
            var floatV: vec3f = vec3f(
                decodeFixedPoint(cells[id.x].vx), 
                decodeFixedPoint(cells[id.x].vy), 
                decodeFixedPoint(cells[id.x].vz)
            );
            floatV /= decodeFixedPoint(cells[id.x].mass);

            let strength = smoothstep(r*r, 0., cellSquareDistToMouse) * 0.2;   
            cells[id.x].vx = encodeFixedPoint(floatV.x + strength * forceDir.x); 
            cells[id.x].vy = encodeFixedPoint(floatV.y + strength * forceDir.y - 0.40 * dt); 
            cells[id.x].vz = encodeFixedPoint(floatV.z + strength * forceDir.z); 

            var x: i32 = i32(id.x) / i32(initBoxSize.z) / i32(initBoxSize.y);
            var y: i32 = (i32(id.x) / i32(initBoxSize.z)) % i32(initBoxSize.y);
            var z: i32 = i32(id.x) % i32(initBoxSize.z);
            if (x < 2 || x > i32(ceil(realBoxSize.x) - 3)) { cells[id.x].vx = 0; } 
            if (y < 2 || y > i32(ceil(realBoxSize.y) - 3)) { cells[id.x].vy = 0; }
            if (z < 2 || z > i32(ceil(realBoxSize.z) - 3)) { cells[id.x].vz = 0; }
        }
    }
}