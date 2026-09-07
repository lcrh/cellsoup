const vertex = `#version 300 es
precision highp float;
in vec2 position;in float energy;in float hue;in float id;in float shield;in float heading;in float lineage;
uniform vec2 resolution;uniform vec2 center;uniform float scale;uniform float dpr;uniform float selected;uniform float mode;
out vec3 tint;out float armor;out float chosen;out float rotation;
vec3 hsv(float h){return clamp(abs(fract(vec3(h)+vec3(0.,.6667,.3333))*6.-3.)-1.,0.,1.);}
void main(){vec2 p=(position-center)*scale;gl_Position=vec4(p.x/resolution.x*2.,-p.y/resolution.y*2.,0.,1.);gl_PointSize=max(3.,12.*scale*dpr);tint=mix(vec3(.2),hsv(hue),.8)*(.35+.65*clamp(energy/100.,0.,1.));if(mode>1.5)tint=mix(vec3(.2),hsv(lineage),.8)*(.35+.65*clamp(energy/100.,0.,1.));else if(mode>0.5)tint=mix(vec3(.95,.23,.15),vec3(.3,1.,.67),clamp(energy/140.,0.,1.));armor=shield;chosen=abs(id-selected)<.1?1.:0.;rotation=heading*6.283185;}`;
const fragment = `#version 300 es
precision highp float;
in vec3 tint;in float armor;in float chosen;in float rotation;out vec4 outColor;
void main(){vec2 p=gl_PointCoord*2.-1.;float d=length(p);if(d>1.)discard;float rim=smoothstep(.62,.82,d);vec3 c=mix(tint*.35,tint+vec3(.18),rim);c+=chosen*vec3(.65);if(armor>.05&&d>.9)c=mix(c,vec3(.85,.9,1.),armor);vec2 tip=vec2(cos(rotation),sin(rotation))*.36;if(length(p-tip)<.14)c+=.35;outColor=vec4(c,1.-smoothstep(.92,1.,d));}`;
const lineVertex = `#version 300 es
in vec2 position;uniform vec2 resolution;uniform vec2 center;uniform float scale;
void main(){vec2 p=(position-center)*scale;gl_Position=vec4(p.x/resolution.x*2.,-p.y/resolution.y*2.,0.,1.);}`;
const lineFragment = `#version 300 es
precision highp float;out vec4 outColor;void main(){outColor=vec4(.28,.66,.57,.36);}`;
const foodVertex = `#version 300 es
in vec2 position;out vec2 uv;void main(){uv=position*.5+.5;gl_Position=vec4(position,0.,1.);}`;
const foodFragment = `#version 300 es
precision highp float;
in vec2 uv;uniform sampler2D soup;uniform vec2 resolution;uniform vec2 center;uniform float scale;uniform float visible;out vec4 outColor;
void main(){vec2 p=(vec2(uv.x,1.-uv.y)-.5)*resolution/scale+center;vec2 f=p/vec2(1600.,1000.);float v=texture(soup,f).r*visible;float boundary=step(0.,p.x)*step(p.x,1600.)*step(0.,p.y)*step(p.y,1000.);vec3 bg=vec3(.018,.037,.042);float grid=step(.965,fract(p.x/100.))+step(.965,fract(p.y/100.));bg+=grid*.008*boundary;bg+=vec3(.12,.22,.09)*(1.-exp(-v*.09))*boundary;bg*=.6+.4*boundary;outColor=vec4(bg,1.);}`;
export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.gl = canvas.getContext("webgl2", { antialias: false, alpha: false });
    if (!this.gl)
      throw Error(
        "WebGL 2 is required. Try a browser with hardware acceleration enabled.",
      );
    this.center = [800, 500];
    this.zoom = 1;
    this.selected = 0;
    this.mode = 0;
    this.showFood = true;
    this.showBonds = true;
    const gl = this.gl;
    const program = (vs, fs) => {
      const p = gl.createProgram();
      for (const [type, source] of [
        [gl.VERTEX_SHADER, vs],
        [gl.FRAGMENT_SHADER, fs],
      ]) {
        const s = gl.createShader(type);
        gl.shaderSource(s, source);
        gl.compileShader(s);
        if (!gl.getShaderParameter(s, gl.COMPILE_STATUS))
          throw Error(gl.getShaderInfoLog(s));
        gl.attachShader(p, s);
      }
      gl.linkProgram(p);
      if (!gl.getProgramParameter(p, gl.LINK_STATUS))
        throw Error(gl.getProgramInfoLog(p));
      return p;
    };
    this.cellsProgram = program(vertex, fragment);
    this.linesProgram = program(lineVertex, lineFragment);
    this.foodProgram = program(foodVertex, foodFragment);
    this.cellsBuffer = gl.createBuffer();
    this.linesBuffer = gl.createBuffer();
    this.quad = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quad);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
      gl.STATIC_DRAW,
    );
    this.texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    // Float texture filtering is optional; normalized bytes give portable smooth food rendering.
    this.foodBytes = new Uint8Array(128 * 80);
    this.resize();
    new ResizeObserver(() => {
      this.resize();
      if (this.frame) this.draw(this.frame);
    }).observe(canvas);
  }
  resize() {
    const r = this.canvas.getBoundingClientRect();
    this.width = r.width;
    this.height = r.height;
    this.dpr = Math.min(devicePixelRatio || 1, 2);
    this.canvas.width = Math.round(r.width * this.dpr);
    this.canvas.height = Math.round(r.height * this.dpr);
    this.baseScale = Math.min(r.width / 1700, r.height / 1100);
    this.scale = this.baseScale * this.zoom;
    this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
  }
  world(x, y) {
    return [
      (x - this.width / 2) / this.scale + this.center[0],
      (y - this.height / 2) / this.scale + this.center[1],
    ];
  }
  zoomAt(x, y, factor) {
    const before = this.world(x, y);
    this.zoom = Math.max(0.5, Math.min(12, this.zoom * factor));
    this.scale = this.baseScale * this.zoom;
    const after = this.world(x, y);
    this.center[0] += before[0] - after[0];
    this.center[1] += before[1] - after[1];
    if (this.frame) this.draw(this.frame);
  }
  uniforms(p) {
    const g = this.gl;
    g.useProgram(p);
    g.uniform2f(g.getUniformLocation(p, "resolution"), this.width, this.height);
    g.uniform2fv(g.getUniformLocation(p, "center"), this.center);
    g.uniform1f(g.getUniformLocation(p, "scale"), this.scale);
  }
  attrib(p, name, size, stride, offset) {
    const g = this.gl,
      l = g.getAttribLocation(p, name);
    if (l >= 0) {
      g.enableVertexAttribArray(l);
      g.vertexAttribPointer(l, size, g.FLOAT, false, stride, offset);
    }
  }
  draw(frame) {
    this.frame = frame;
    const g = this.gl;
    g.clearColor(0.02, 0.04, 0.045, 1);
    g.clear(g.COLOR_BUFFER_BIT);
    this.uniforms(this.foodProgram);
    g.bindBuffer(g.ARRAY_BUFFER, this.quad);
    this.attrib(this.foodProgram, "position", 2, 0, 0);
    g.bindTexture(g.TEXTURE_2D, this.texture);
    for (let i = 0; i < this.foodBytes.length; i++)
      this.foodBytes[i] = Math.min(255, frame.food[i] * 3.1875);
    g.texImage2D(
      g.TEXTURE_2D,
      0,
      g.R8,
      128,
      80,
      0,
      g.RED,
      g.UNSIGNED_BYTE,
      this.foodBytes,
    );
    g.uniform1f(
      g.getUniformLocation(this.foodProgram, "visible"),
      this.showFood ? 80 : 0,
    );
    g.drawArrays(g.TRIANGLE_STRIP, 0, 4);
    if (this.showBonds && frame.links.length) {
      this.uniforms(this.linesProgram);
      g.bindBuffer(g.ARRAY_BUFFER, this.linesBuffer);
      g.bufferData(g.ARRAY_BUFFER, frame.links, g.DYNAMIC_DRAW);
      this.attrib(this.linesProgram, "position", 2, 0, 0);
      g.drawArrays(g.LINES, 0, frame.links.length / 2);
    }
    const p = this.cellsProgram;
    this.uniforms(p);
    g.uniform1f(g.getUniformLocation(p, "dpr"), this.dpr);
    g.uniform1f(g.getUniformLocation(p, "selected"), this.selected);
    g.uniform1f(g.getUniformLocation(p, "mode"), this.mode);
    g.bindBuffer(g.ARRAY_BUFFER, this.cellsBuffer);
    g.bufferData(g.ARRAY_BUFFER, frame.cells, g.DYNAMIC_DRAW);
    for (const [name, size, offset] of [
      ["position", 2, 0],
      ["energy", 1, 8],
      ["hue", 1, 12],
      ["id", 1, 16],
      ["shield", 1, 20],
      ["heading", 1, 24],
      ["lineage", 1, 28],
    ])
      this.attrib(p, name, size, 32, offset);
    g.drawArrays(g.POINTS, 0, frame.cells.length / 8);
    // Attribute arrays belong to the context, so disable them before differently sized draws.
    for (let i = 0; i < g.getParameter(g.MAX_VERTEX_ATTRIBS); i++)
      g.disableVertexAttribArray(i);
  }
}
