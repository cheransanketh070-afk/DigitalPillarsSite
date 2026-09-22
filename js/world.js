(function(){
  'use strict';

  const canvas = document.getElementById('world');
  if (!canvas) return;

  const gl = canvas.getContext('webgl', {
    antialias: true,
    alpha: false,
    preserveDrawingBuffer: false,
    powerPreference: 'high-performance'
  });

  if (!gl) {
    canvas.style.display = 'none';
    return;
  }

  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const vs = `
    attribute vec3 aPos;
    attribute vec3 aNormal;
    attribute vec3 aColor;
    uniform mat4 uMVP;
    uniform mat4 uModel;
    uniform vec3 uLight;
    varying vec3 vColor;
    varying float vLight;
    void main(){
      vec3 n=normalize(mat3(uModel)*aNormal);
      float d=max(dot(n,normalize(uLight)),0.0);
      vColor=aColor;
      vLight=.2+.8*d;
      gl_Position=uMVP*vec4(aPos,1.0);
    }
  `;

  const fs = `
    precision mediump float;
    varying vec3 vColor;
    varying float vLight;
    uniform float uAlpha;
    void main(){
      gl_FragColor=vec4(vColor*vLight,uAlpha);
    }
  `;

  const ps = `
    attribute vec3 aPos;
    attribute float aSize;
    uniform mat4 uMVP;
    uniform float uTime;
    varying float vDepth;
    void main(){
      vec3 p=aPos;
      p.x+=sin(uTime*.34+p.z*1.8)*.105;
      p.y+=cos(uTime*.25+p.x*2.0)*.075;
      p.z+=sin(uTime*.21+p.y*1.7)*.06;
      gl_Position=uMVP*vec4(p,1.0);
      vDepth=clamp(1.0/max(.28,-gl_Position.z),0.0,1.0);
      gl_PointSize=aSize*(.76+.74*vDepth);
    }
  `;

  const pfs = `
    precision mediump float;
    uniform float uAlpha;
    varying float vDepth;
    void main(){
      vec2 uv=gl_PointCoord-.5;
      float d=dot(uv,uv);
      float a=smoothstep(.25,0.0,d)*uAlpha*(.6+.4*vDepth);
      gl_FragColor=vec4(.32,.72,1.0,a);
    }
  `;

  function compileProgram(vertex, fragment){
    const program = gl.createProgram();
    for (const [source, type] of [[vertex, gl.VERTEX_SHADER],[fragment, gl.FRAGMENT_SHADER]]) {
      const shader = gl.createShader(type);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error('[Digital Pillars] WebGL shader error:', gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        gl.deleteProgram(program);
        return null;
      }
      gl.attachShader(program, shader);
      gl.deleteShader(shader);
    }
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error('[Digital Pillars] WebGL program error:', gl.getProgramInfoLog(program));
      gl.deleteProgram(program);
      return null;
    }
    return program;
  }

  const P = compileProgram(vs, fs);
  const PP = compileProgram(ps, pfs);
  if (!P || !PP) {
    canvas.style.display = 'none';
    return;
  }

  const loc = {
    pos: gl.getAttribLocation(P, 'aPos'),
    normal: gl.getAttribLocation(P, 'aNormal'),
    color: gl.getAttribLocation(P, 'aColor'),
    mvp: gl.getUniformLocation(P, 'uMVP'),
    model: gl.getUniformLocation(P, 'uModel'),
    light: gl.getUniformLocation(P, 'uLight'),
    alpha: gl.getUniformLocation(P, 'uAlpha')
  };

  const ploc = {
    pos: gl.getAttribLocation(PP, 'aPos'),
    size: gl.getAttribLocation(PP, 'aSize'),
    mvp: gl.getUniformLocation(PP, 'uMVP'),
    time: gl.getUniformLocation(PP, 'uTime'),
    alpha: gl.getUniformLocation(PP, 'uAlpha')
  };

  const mat4 = () => new Float32Array([
    1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1
  ]);

  function mul(a,b){
    const out = new Float32Array(16);
    for(let r=0;r<4;r++){
      for(let c=0;c<4;c++){
        out[c+r*4]=a[r*4]*b[c]+a[r*4+1]*b[c+4]+a[r*4+2]*b[c+8]+a[r*4+3]*b[c+12];
      }
    }
    return out;
  }

  function persp(fov,asp,n,f){
    const t=1/Math.tan(fov/2);
    const out=mat4();
    out[0]=t/asp;
    out[5]=t;
    out[10]=(f+n)/(n-f);
    out[11]=-1;
    out[14]=2*f*n/(n-f);
    out[15]=0;
    return out;
  }

  function trans(x,y,z){
    const out=mat4();
    out[12]=x;out[13]=y;out[14]=z;
    return out;
  }

  function scale(x,y,z){
    const out=mat4();
    out[0]=x;out[5]=y;out[10]=z;
    return out;
  }

  function ry(a){
    const c=Math.cos(a),s=Math.sin(a),out=mat4();
    out[0]=c;out[2]=s;out[8]=-s;out[10]=c;
    return out;
  }

  function rx(a){
    const c=Math.cos(a),s=Math.sin(a),out=mat4();
    out[5]=c;out[6]=-s;out[9]=s;out[10]=c;
    return out;
  }

  function hexPrism(r,h,col,x,y,z,rot=0){
    const verts=[],normals=[],colors=[],indices=[];
    for(let i=0;i<6;i++){
      const a=rot+i*Math.PI/3;
      verts.push(r*Math.cos(a),-h/2,r*Math.sin(a));
      verts.push(r*Math.cos(a),h/2,r*Math.sin(a));
    }
    for(let i=0;i<6;i++){
      const a=rot+(i+.5)*Math.PI/3;
      const nx=Math.cos(a),nz=Math.sin(a);
      for(let k=0;k<2;k++){
        normals.push(nx,0,nz);
        colors.push(col[0],col[1],col[2]);
      }
    }
    colors.push(col[0]*.72,col[1]*.72,col[2]*.72,col[0],col[1],col[2]);
    for(let i=0;i<6;i++){
      const a=i*2,b=((i+1)%6)*2;
      indices.push(a,b,a+1,b,b+1,a+1);
    }
    const base=verts.length/3;
    verts.push(0,h/2,0,0,-h/2,0);
    normals.push(0,1,0,0,-1,0);
    colors.push(col[0]*1.22,col[1]*1.22,col[2]*1.22,col[0]*.5,col[1]*.5,col[2]*.5);
    for(let i=0;i<6;i++){
      indices.push(base,((i+1)%6)*2+1,i*2+1);
      indices.push(base+1,i*2,((i+1)%6)*2);
    }
    return {verts,normals,colors,indices,x,y,z};
  }

  const meshes=[];
  for(let i=0;i<12;i++){
    const angle=i/12*Math.PI*2;
    const radius=.30+.11*(i%4);
    meshes.push(hexPrism(
      radius,
      .72+.62*((i*5)%6)/5,
      [.24+.045*(i%3),.52+.065*(i%4),.90+.035*(i%5)],
      Math.cos(angle)*.30,
      (i%2 ? -.02 : .02),
      Math.sin(angle)*.30,
      angle
    ));
  }

  meshes.push(hexPrism(.25,2.4,[.57,.84,1.0],0,.05,0,.25));
  meshes.push(hexPrism(.18,1.7,[.34,.68,1.0],-.42,-.08,.03,.45));
  meshes.push(hexPrism(.16,1.38,[.42,.78,1.0],.46,-.22,-.05,.05));
  meshes.push(hexPrism(.11,1.05,[.24,.60,1.0],0,.72,.0,.25));

  for(const mesh of meshes){
    mesh.v=gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER,mesh.v);
    gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(mesh.verts),gl.STATIC_DRAW);
    mesh.n=gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER,mesh.n);
    gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(mesh.normals),gl.STATIC_DRAW);
    mesh.c=gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER,mesh.c);
    gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(mesh.colors),gl.STATIC_DRAW);
    mesh.i=gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,mesh.i);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,new Uint16Array(mesh.indices),gl.STATIC_DRAW);
    mesh.count=mesh.indices.length;
  }

  const particleCount = reduceMotion ? 300 : 720;
  const particlePositions=[];
  for(let i=0;i<particleCount;i++){
    const angle=Math.random()*Math.PI*2;
    const radius=.8+Math.random()*3.5;
    const y=(Math.random()-.5)*4.1;
    particlePositions.push(Math.cos(angle)*radius,y,Math.sin(angle)*radius);
  }

  const pb=gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER,pb);
  gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(particlePositions),gl.STATIC_DRAW);

  const sb=gl.createBuffer();
  const sizes=new Float32Array(particleCount);
  for(let i=0;i<particleCount;i++) sizes[i]=1.3+Math.random()*2.9;
  gl.bindBuffer(gl.ARRAY_BUFFER,sb);
  gl.bufferData(gl.ARRAY_BUFFER,sizes,gl.STATIC_DRAW);

  let W=innerWidth;
  let H=innerHeight;
  let dpr=1;

  function resize(){
    W=innerWidth;
    H=innerHeight;
    dpr=Math.min(devicePixelRatio || 1,1.5);
    canvas.width=Math.max(1,Math.floor(W*dpr));
    canvas.height=Math.max(1,Math.floor(H*dpr));
    canvas.style.width='100%';
    canvas.style.height='100%';
    gl.viewport(0,0,canvas.width,canvas.height);
  }

  addEventListener('resize',resize,{passive:true});
  resize();

  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);
  gl.enable(gl.DEPTH_TEST);
  gl.depthFunc(gl.LEQUAL);
  gl.enable(gl.CULL_FACE);

  let scene=0;
  let running=true;
  let startedAt=performance.now();
  let pointerX=0;
  let pointerY=0;
  let smoothX=0;
  let smoothY=0;

  window.DPWorld={
    setScene(next){scene=Number.isFinite(next)?next:0;}
  };

  addEventListener('pointermove',(event)=>{
    if(event.pointerType==='touch') return;
    pointerX=(event.clientX/Math.max(innerWidth,1)-.5)*2;
    pointerY=(event.clientY/Math.max(innerHeight,1)-.5)*2;
  },{passive:true});

  document.addEventListener('visibilitychange',()=>{
    running=document.visibilityState==='visible';
    if(running){
      startedAt=performance.now();
      requestAnimationFrame(frame);
    }
  },{passive:true});

  function frame(now){
    if(!running) return;

    const tm=(now-startedAt)/1000;
    smoothX += (pointerX-smoothX)*.075;
    smoothY += (pointerY-smoothY)*.075;

    const asp=W/Math.max(H,1);
    const proj=persp(1.0,asp,.1,20);
    const cameraShift=scene===1?-1.18:scene===2?.58:scene===4?.10:0;
    const camZ=6.55-scene*.18;
    const camX=Math.sin(tm*.20)*.34+cameraShift+smoothX*.22;
    const camY=Math.cos(tm*.17)*.11+smoothY*.07;
    const view=mul(rx(camY*.1),mul(ry(0),trans(-camX,-.12,-camZ)));
    const vp=mul(proj,view);

    gl.clearColor(.006,.012,.022,1);
    gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);

    gl.useProgram(PP);
    gl.bindBuffer(gl.ARRAY_BUFFER,pb);
    gl.enableVertexAttribArray(ploc.pos);
    gl.vertexAttribPointer(ploc.pos,3,gl.FLOAT,false,0,0);
    gl.bindBuffer(gl.ARRAY_BUFFER,sb);
    gl.enableVertexAttribArray(ploc.size);
    gl.vertexAttribPointer(ploc.size,1,gl.FLOAT,false,0,0);
    gl.uniformMatrix4fv(ploc.mvp,false,vp);
    gl.uniform1f(ploc.time,tm);
    gl.uniform1f(ploc.alpha,scene===3?.40:.68);
    gl.depthMask(false);
    gl.drawArrays(gl.POINTS,0,particleCount);
    gl.depthMask(true);

    gl.useProgram(P);
    gl.uniform3f(loc.light,-.46,1,.75);
    gl.uniform1f(loc.alpha,scene===3?.82:1);

    for(let i=0;i<meshes.length;i++){
      const m=meshes[i];
      const wob=reduceMotion?0:Math.sin(tm*1.05+i*0.75)*.035;
      let x=m.x, y=m.y+wob, z=m.z;
      let rotY=tm*.68*(i%2?-1:1)+i*.25;
      let rotX=Math.sin(tm*.42+i*.55)*.11;

      if(scene===1){
        x=m.x-.62*(i%3);
        z=m.z-.045*i;
        rotY=tm*.82+i*.22;
        rotX=.15;
      } else if(scene===2){
        x=m.x*.70;
        z=m.z*.70;
        rotY=-tm*.57+i*.2;
      } else if(scene===4){
        x=m.x*1.08-.28;
        z=m.z-.68;
        rotY=tm*.64+i*.10;
        rotX=.10;
      }

      const model=mul(
        trans(x,y,z),
        mul(ry(rotY),rx(rotX))
      );
      const mvp=mul(vp,model);

      gl.uniformMatrix4fv(loc.mvp,false,mvp);
      gl.uniformMatrix4fv(loc.model,false,model);
      gl.bindBuffer(gl.ARRAY_BUFFER,m.v);
      gl.enableVertexAttribArray(loc.pos);
      gl.vertexAttribPointer(loc.pos,3,gl.FLOAT,false,0,0);
      gl.bindBuffer(gl.ARRAY_BUFFER,m.n);
      gl.enableVertexAttribArray(loc.normal);
      gl.vertexAttribPointer(loc.normal,3,gl.FLOAT,false,0,0);
      gl.bindBuffer(gl.ARRAY_BUFFER,m.c);
      gl.enableVertexAttribArray(loc.color);
      gl.vertexAttribPointer(loc.color,3,gl.FLOAT,false,0,0);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,m.i);
      gl.drawElements(gl.TRIANGLES,m.count,gl.UNSIGNED_SHORT,0);
    }

    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
})();
