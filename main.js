import * as THREE from "three"
import {OrbitControls} from 'three/examples/jsm/controls/OrbitControls'
import { MapControls } from 'three/examples/jsm/controls/MapControls.js';
import './style.css'
import { ARMS, ARM_X_DIST, ARM_X_MEAN, ARM_Y_DIST, ARM_Y_MEAN, CORE_X_DIST, CORE_Y_DIST, GALAXY_THICKNESS, HAZE_RATIO, NUM_STARS, OUTER_CORE_X_DIST, OUTER_CORE_Y_DIST } from './config/galaxyConfig.js';
import { BLOOM_LAYER, STAR_MAX, STAR_MIN, BLOOM_PARAMS, OVERLAY_LAYER, BASE_LAYER } from './config/renderConfig.js'
import { gaussianRandom, spiral } from './utils.js';
import { Haze } from './objects/haze.js';
import { CompositionShader} from './shaders/CompositionShader.js'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';

import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';

/**
 * Galaxy
 */
const parameters = {}
parameters.count = 25000
parameters.size = 1
parameters.radius = 10
parameters.branches = 2
parameters.spin = 1.5
parameters.randomness = 3
parameters.randomnessPower = 1.7
parameters.insideColor = '#eb3700'
parameters.outsideColor = '#99edf7'

let 
    points,
    pointsIndexed,
    pointsIndexedOffset,
    pointclouds,
    geometry,
    geometryIndexed,
    geometryIndexedWithOffset,
    material,
    canvas,
    renderer,
    scene,
    camera,
    orbit,
    composer,
    bloomComposer,
    overlayComposer,
    baseComposer,
    controls,
    raycaster,
    pointer,
    sphere,
    isClicking,
    positions,
    positionsInit

const generateGalaxy = ( ) =>
{
    /**
     * Geometry
     */
    geometry = new THREE.BufferGeometry()
    geometryIndexed = new THREE.BufferGeometry()
    geometryIndexedWithOffset = new THREE.BufferGeometry()
    
    const positionsTmp = []
    const colors = new Float32Array(parameters.count * 3)

    const colorInside = new THREE.Color(parameters.insideColor)
    const colorOutside = new THREE.Color(parameters.outsideColor)

    
    for(let i = 0; i < parameters.count / 4 ; i++)
    {
        positionsTmp.push( gaussianRandom(0, CORE_X_DIST))
        positionsTmp.push( gaussianRandom(0, CORE_Y_DIST))
        positionsTmp.push( gaussianRandom(0, GALAXY_THICKNESS))
    }
    for(let i = 0; i < parameters.count / 4 ; i++)
    {
        positionsTmp.push( gaussianRandom(0, OUTER_CORE_X_DIST))
        positionsTmp.push( gaussianRandom(0, OUTER_CORE_Y_DIST))
        positionsTmp.push( gaussianRandom(0, GALAXY_THICKNESS))
    }
    for (let j = 0; j < ARMS; j++) {
        for ( let i = 0; i < parameters.count / 4; i++){
            let pos = spiral(gaussianRandom(ARM_X_MEAN, ARM_X_DIST), gaussianRandom(ARM_Y_MEAN, ARM_Y_DIST), gaussianRandom(0, GALAXY_THICKNESS), j * 2 * Math.PI / ARMS)
            positionsTmp.push(pos.x) 
            positionsTmp.push(pos.y) 
            positionsTmp.push(pos.z) 
        }
    }
    const indices = new Uint16Array( positionsTmp.length );
    const indicesWithOffset = new Uint16Array( positionsTmp.length );
    positions = new Float32Array(positionsTmp.length)
    for ( let i = 0; i < positionsTmp.length; i++)
    {
        positions[i] = positionsTmp[i];
        indices[i] = i;
        indicesWithOffset[i] = i;
    }
    positionsInit = Object.assign({}, positions);
    //Color
    // const mixedColor = colorInside.clone()

    // colors[i3    ] = mixedColor.r
    // colors[i3 + 1] = mixedColor.g
    // colors[i3 + 2] = mixedColor.b
    console.log("positions", positions);

    geometry.setAttribute( 'position', new THREE.BufferAttribute(positions, 3) )
    geometryIndexed.setAttribute( 'position', new THREE.BufferAttribute(positions, 3) )
    geometryIndexedWithOffset.setAttribute( 'position', new THREE.BufferAttribute(positions, 3) )

    geometryIndexed.setIndex( new THREE.BufferAttribute( indices, 1 ) );
    geometryIndexedWithOffset.setIndex( new THREE.BufferAttribute( indicesWithOffset, 1 ) );
     
    geometryIndexedWithOffset.addGroup( 0, indicesWithOffset.length );

    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3) )

    const spriteTexture = new THREE.TextureLoader().load( './resources/sprite120.png' );    
    /**
     * Material
     */
     material = new THREE.PointsMaterial({
        size: parameters.size,
        sizeAttenuation: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        // vertexColors: true,
        // color:0xFFFFFF,
        alphaMap: spriteTexture,
        transparent: true,
    })
        
    /**
    * Points
    */
   points = new THREE.Points(geometry, material)
   pointsIndexed = new THREE.Points(geometry, material)
   pointsIndexedOffset = new THREE.Points(geometry, material)
   scene.add(points)
   scene.add(points)
   scene.add(points)
   pointclouds = [ points, pointsIndexed, pointsIndexedOffset ];
}
    
/**
 * Sizes
 */
const sizes = {
    width: window.innerWidth,
    height: window.innerHeight
}

window.addEventListener('resize', () =>
{
    sizes.width = window.innerWidth
    sizes.height = window.innerHeight

    camera.aspect = sizes.width / sizes.height
    camera.updateProjectionMatrix()

    renderer.setSize(sizes.width, sizes.height)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
})
/**
 * Renderer
 */
function initRender() {

    // Assign Renderer
    renderer = new THREE.WebGLRenderer({
        antialias: true,
        canvas,
        // logarithmicDepthBuffer: true,
    })
    renderer.setPixelRatio( window.devicePixelRatio )
    renderer.setSize( window.innerWidth, window.innerHeight )
    renderer.outputEncoding = THREE.sRGBEncoding
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 0.5
    renderer.toneMapping = THREE.ReinhardToneMapping;

    const renderScene = new RenderPass( scene, camera );

    const bloomPass = new UnrealBloomPass( new THREE.Vector2( window.innerWidth, window.innerHeight ), 0.5, 0.1, 0.85 );
    bloomPass.threshold = BLOOM_PARAMS.bloomThreshold;
    bloomPass.strength = BLOOM_PARAMS.bloomStrength;
    bloomPass.radius = BLOOM_PARAMS.bloomRadius;

    // const outputPass = new OutputPass();

    composer = new EffectComposer( renderer );
    composer.addPass( renderScene );
    composer.addPass( bloomPass );
    // composer.addPass( outputPass );
}
function init()
{
    canvas = document.querySelector('canvas.webgl')
    
    // const cubeTextureLoader = new THREE.CubeTextureLoader();
    // const environmentMapTexture = cubeTextureLoader.load(
    //   [
    //     'https://closure.vps.wbsprt.com/files/earth/space/px.png',
    //     'https://closure.vps.wbsprt.com/files/earth/space/nx.png',
    //     'https://closure.vps.wbsprt.com/files/earth/space/py.png',
    //     'https://closure.vps.wbsprt.com/files/earth/space/ny.png',
    //     'https://closure.vps.wbsprt.com/files/earth/space/pz.png',
    //     'https://closure.vps.wbsprt.com/files/earth/space/nz.png',
    //   ],
    // );
    // scene.background = environmentMapTexture;
    scene = new THREE.Scene();
    scene.add( new THREE.AmbientLight( 0xcccccc  ) );
    scene.fog = new THREE.FogExp2(0xEBE2DB, 0.00003);

    // camera
    camera = new THREE.PerspectiveCamera( 60, window.innerWidth / window.innerHeight, 0.1, 5000000 );
    camera.position.set(0, 500, 500);
    camera.up.set(0, 0, 1);
    camera.lookAt(0, 0, 0);

    const pointLight = new THREE.PointLight( 0xffffff, 1 );
    camera.add( pointLight );

    // map orbit
    orbit = new MapControls(camera, canvas)
    orbit.enableDamping = true; // an animation loop is required when either damping or auto-rotation are enabled
    orbit.dampingFactor = 0.05;
    orbit.screenSpacePanning = false;
    orbit.minDistance = 1;
    orbit.maxDistance = 16384;
    orbit.maxPolarAngle = (Math.PI / 2) - (Math.PI / 360)

    raycaster = new THREE.Raycaster()
    pointer = new THREE.Vector2()
    const sphereGeometry = new THREE.SphereGeometry( 1, 32, 32 );
    // const sphereMaterial = new THREE.MeshBasicMaterial( { transparent:true, opacity:1 } );
    const sphereMaterial = new THREE.MeshBasicMaterial( { color:0xffffff} );
    sphere = new THREE.Mesh( sphereGeometry, sphereMaterial );
    scene.add( sphere );

    initRender()
}
window.addEventListener('pointerdown', e => isClicking = true)
window.addEventListener('pointerup', e => isClicking = false)
window.addEventListener('pointermove', (event) => {
    pointer.x = ( event.clientX / window.innerWidth ) * 2 - 1;
    pointer.y = - ( event.clientY / window.innerHeight ) * 2 + 1;
})
function renderPipeline() {

    // Render bloom
    // camera.layers.set(BLOOM_LAYER)
    // bloomComposer.render()

    // Render overlays
    // camera.layers.set(OVERLAY_LAYER)
    // overlayComposer.render()

    // Render normal
    // camera.layers.set(BASE_LAYER)
    composer.render();
    // renderer.render(scene, camera)
}
function resizeRendererToDisplaySize(renderer) {
    const canvas = renderer.domElement;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    const needResize = canvas.width !== width || canvas.height !== height;
    if (needResize) {
      renderer.setSize(width, height, false);
    }
    return needResize;
}
/**
 * Animate
 */
const clock = new THREE.Clock()

async function render() {

    orbit.update()

    // fix buffer size
    if (resizeRendererToDisplaySize(renderer)) {
        const canvas = renderer.domElement;
        camera.aspect = canvas.clientWidth / canvas.clientHeight;
        camera.updateProjectionMatrix();
    }

    // fix aspect ratio
    const canvas = renderer.domElement;
    camera.aspect = canvas.clientWidth / canvas.clientHeight;
    camera.updateProjectionMatrix();
    const elapsedTime = clock.getElapsedTime()
    points.rotation.z = elapsedTime * 0.05
    // galaxy.updateScale(camera)

    // Raycaster
    // update the picking ray with the camera and pointer position
    raycaster.setFromCamera( pointer, camera );

    const intersections = raycaster.intersectObjects( pointclouds, false );
    const intersection = ( intersections.length ) > 0 ? intersections[ 0 ] : null;
    if ( intersection !== null && isClicking == true) 
    {
        console.log("intersection.point", intersection.point);
        sphere.position.copy( intersection.point );
        sphere.scale.set( 10, 10, 10 );
    }
    // else
    // {
    //     sphere.position.copy( new THREE.Vector3(0,0,0));
    // }

    // Run each pass of the render pipeline
    renderPipeline()

    requestAnimationFrame(render)

}
init()
generateGalaxy()
requestAnimationFrame(render)
