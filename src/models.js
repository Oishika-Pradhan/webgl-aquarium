var m = require('./matrix')

function openFile(name, filename){
  var datastring;
  $.ajax({
    url : filename + '.obj',
    dataType: "text",
    success : function (data) {
      datastring = data;
      $.ajax({
        url : filename + '.mtl',
        dataType: "text",
        success : function (mtlstring) {
          createModel(name, datastring, mtlstring);
        }
      })
    }
  });
}

function makeModel(name, filename, center = [0, 0, 0], scale = [1, 1, 1], invertNormals = false) {
  models[name] = {name, center, scale, invertNormals};
  openFile(name, filename);
}

function parseMtl(mtlstring) {
  var mtllib = {}
  var lines = mtlstring.split('\n');
  var curmtl = ''
  for (var j=0; j<lines.length; j++) {
    var words = lines[j].split(' ');
    if (words[0] == 'newmtl') {
      curmtl = words[1]
      mtllib[curmtl] = {}
    } else if (words[0] == 'Kd') {
      mtllib[curmtl].diffuse = [
        parseFloat(words[1]),
        parseFloat(words[2]),
        parseFloat(words[3]),
      ]
    } else if (words[0] == 'Ks') {
      mtllib[curmtl].specular = [
        parseFloat(words[1]),
        parseFloat(words[2]),
        parseFloat(words[3]),
      ]
    } else if (words[0] == 'Ka') {
      mtllib[curmtl].ambient = [
        parseFloat(words[1]),
        parseFloat(words[2]),
        parseFloat(words[3]),
      ]
    } else if (words[0] == 'Ns') {
      mtllib[curmtl].shininess = parseFloat(words[1])
    }
  }
  return mtllib
}

function createModel(name, filedata, mtlstring) //Create object from blender
{
  var model = models[name];
  var mtllib = parseMtl(mtlstring)
  var vertex_buffer_data = [];
  var points = [];
  var minX = 1000000
  var maxX = -1000000
  var minY = 1000000
  var maxY = -1000000
  var minZ = 1000000
  var maxZ = -1000000

  var normals = [];
  var normal_buffer_data = [];

  model.vaos = [];

  var lines = filedata.split('\n');
  lines.push('usemtl')
  for (var j=0; j<lines.length; j++){
    var words = lines[j].split(' ');
    if(words[0] == "v"){
      var cur_point = {};
      cur_point['x']=parseFloat(words[1]);
      if(cur_point['x']>maxX){
        maxX = cur_point['x']
      }
      if(cur_point['x']<minX){
        minX = cur_point['x']
      }
      cur_point['y']=parseFloat(words[2]);
      if(cur_point['y']>maxY){
        maxY = cur_point['y']
      }
      if(cur_point['y']<minY){
        minY = cur_point['y']
      }
      cur_point['z']=parseFloat(words[3]);
      if(cur_point['z']>maxZ){
        maxZ = cur_point['z']
      }
      if(cur_point['z']<minZ){
        minZ = cur_point['z']
      }
      //console.log(words);
      points.push(cur_point);
    } else if (words[0] == "vn") {
      let cur_point = {};
      cur_point['x']=parseFloat(words[1]);
      cur_point['y']=parseFloat(words[2]);
      cur_point['z']=parseFloat(words[3]);
      //console.log(words);
      normals.push(cur_point);
    }
  }
  model.minX = minX
  model.maxX = maxX
  model.minY = minY
  model.maxY = maxY
  model.minZ = minZ
  model.maxZ = maxZ
  //console.log(points);
  // let lines = filedata.split('\n');
  var curmtl = ''
  for (var jj=0; jj<lines.length; jj++){
    let words = lines[jj].split(' ');
    if(words[0] == "f") {
      for (let wc = 1; wc < 4; wc++) {
        let vxdata = words[wc].split('/')
        let t = parseInt(vxdata[0]) - 1
        let f = parseInt(vxdata[2]) - 1
        vertex_buffer_data.push(points[t].x)
        vertex_buffer_data.push(points[t].y)
        vertex_buffer_data.push(points[t].z)

        if (model.invertNormals) {
          normal_buffer_data.push(-normals[f].x)
          normal_buffer_data.push(-normals[f].y)
          normal_buffer_data.push(-normals[f].z)
        } else {
          normal_buffer_data.push(normals[f].x)
          normal_buffer_data.push(normals[f].y)
          normal_buffer_data.push(normals[f].z)
        }
      }
    } else if (words[0] == 'usemtl') {
      let vao = {}
      vao.numVertex = vertex_buffer_data.length / 3;
      if (vao.numVertex != 0) {
        var vertexBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertex_buffer_data), gl.STATIC_DRAW);
        vao.vertexBuffer = vertexBuffer

        var normalBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, normalBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(normal_buffer_data), gl.STATIC_DRAW);
        vao.normalBuffer = normalBuffer
        vao.material = mtllib[curmtl]

        model.vaos.push(vao)
        vertex_buffer_data = []
        normal_buffer_data = []
      }
      curmtl = words[1]
    }
  }
}

function drawModel (model) {
  if (!model.vaos) return

  gl.uniformMatrix4fv(gl.getUniformLocation(program, "model"), false, Matrices.model);
  gl.uniformMatrix4fv(gl.getUniformLocation(program, "modelInv"), false, m.inverse(Matrices.model));

  model.vaos.map(drawVAO)
}

function drawLight(model) {
  gl.uniform1i(gl.getUniformLocation(program, "isLight"), 1);
  drawModel(model);
  gl.uniform1i(gl.getUniformLocation(program, "isLight"), 0);
}

function drawVAO(vao) {
  if (!vao.vertexBuffer) return;

  loadMaterial(vao.material)

  gl.bindBuffer(gl.ARRAY_BUFFER, vao.vertexBuffer)
  gl.vertexAttribPointer(program.positionAttribute, 3, gl.FLOAT, false, 0, 0);

  gl.bindBuffer(gl.ARRAY_BUFFER, vao.normalBuffer)
  gl.vertexAttribPointer(program.normalAttribute, 3, gl.FLOAT, false, 0, 0);

  // draw
  gl.drawArrays(gl.TRIANGLES, 0, vao.numVertex);
}

function loadMaterial(material) {
  if (!material) material = {
    ambient: [1, 1, 1],
    diffuse: [1, 1, 1],
    specular: [1, 1, 1],
    shininess: 0,
  };
  // Set material properties
  gl.uniform3f(gl.getUniformLocation(program, "material.ambient"),   material.ambient[0], material.ambient[1], material.ambient[2]);
  gl.uniform3f(gl.getUniformLocation(program, "material.diffuse"),   material.diffuse[0], material.diffuse[1], material.diffuse[2]);
  gl.uniform3f(gl.getUniformLocation(program, "material.specular"),  material.specular[0], material.specular[1], material.specular[2]);
  gl.uniform1f(gl.getUniformLocation(program, "material.shininess"), material.shininess);
}

module.exports = {
  makeModel,
  createModel,
  drawModel,
  drawLight,
}
