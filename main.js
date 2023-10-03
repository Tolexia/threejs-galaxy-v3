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
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';

import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';

/**
 * Galaxy
 */
const parameters = {}
parameters.count = 10000
parameters.size = 0.01
parameters.radius = 10
parameters.branches = 2
parameters.spin = 1.5
parameters.randomness = 3
parameters.randomnessPower = 1.7
parameters.insideColor = '#eb3700'
parameters.outsideColor = '#99edf7'

let canvas, renderer, scene, camera, orbit, bloomComposer, overlayComposer, baseComposer, controls 
let geometry = null
let material = null
let points = null

const generateGalaxy = ( ) =>
{
    /**
     * Geometry
     */
    geometry = new THREE.BufferGeometry()
    
    const positions = new Float32Array(parameters.count * 3)
    const colors = new Float32Array(parameters.count * 3)

    const colorInside = new THREE.Color(parameters.insideColor)
    const colorOutside = new THREE.Color(parameters.outsideColor)

    
    for(let i = 0; i < parameters.count; i++)
    {
        const i3 = i * 3

        //Position
        // const radius = Math.random() * parameters.radius
        // const spinAngle = radius * parameters.spin
        // const branchAngle = (i % parameters.branches) / parameters.branches * Math.PI * 2
 
        // const randomX = gaussianRandom(0, CORE_X_DIST)
        // const randomY = gaussianRandom(0, CORE_Y_DIST)
        // const randomZ =  gaussianRandom(0, GALAXY_THICKNESS)
        
        positions[i3    ] =  gaussianRandom(0, CORE_X_DIST)
        positions[i3 + 1] = gaussianRandom(0, CORE_Y_DIST)
        positions[i3 + 2] = gaussianRandom(0, GALAXY_THICKNESS)

        //Color
        // const mixedColor = colorInside.clone()

        // colors[i3    ] = mixedColor.r
        // colors[i3 + 1] = mixedColor.g
        // colors[i3 + 2] = mixedColor.b
    }


    geometry.setAttribute(
        'position',
        new THREE.BufferAttribute(positions, 3)
        )

    geometry.setAttribute(
            'color',
            new THREE.BufferAttribute(colors, 3)
            )

        
    /**
     * Material
     */
     material = new THREE.PointsMaterial({
        size: parameters.size,
        sizeAttenuation: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        vertexColors: true,
        color:0xFFFFFF
    })
        
    /**
    * Points
    */
   points = new THREE.Points(geometry, material)
   points.layers.set(BLOOM_LAYER)
   scene.add(points)
        
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
        logarithmicDepthBuffer: true,
    })
    renderer.setPixelRatio( window.devicePixelRatio )
    renderer.setSize( window.innerWidth, window.innerHeight )
    renderer.outputEncoding = THREE.sRGBEncoding
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 0.5

    // General-use rendering pass for chaining
    const renderScene = new RenderPass( scene, camera )

    // Rendering pass for bloom
    const bloomPass = new UnrealBloomPass( new THREE.Vector2( window.innerWidth, window.innerHeight ), 1.5, 0.4, 0.85 )
    bloomPass.threshold = BLOOM_PARAMS.bloomThreshold
    bloomPass.strength = BLOOM_PARAMS.bloomStrength
    bloomPass.radius = BLOOM_PARAMS.bloomRadius

    // bloom composer
    bloomComposer = new EffectComposer(renderer)
    bloomComposer.renderToScreen = false
    bloomComposer.addPass(renderScene)
    bloomComposer.addPass(bloomPass)

    // overlay composer
    overlayComposer = new EffectComposer(renderer)
    overlayComposer.renderToScreen = false
    overlayComposer.addPass(renderScene)

    // Shader pass to combine base layer, bloom, and overlay layers
    const finalPass = new ShaderPass(
        new THREE.ShaderMaterial( {
            uniforms: {
                baseTexture: { value: null },
                bloomTexture: { value: bloomComposer.renderTarget2.texture },
                overlayTexture: { value: overlayComposer.renderTarget2.texture }
            },
            vertexShader: CompositionShader.vertex,
            fragmentShader: CompositionShader.fragment,
            defines: {}
        } ), 'baseTexture'
    );
    finalPass.needsSwap = true;

    // base layer composer
    baseComposer = new EffectComposer( renderer )
    baseComposer.addPass( renderScene )
    baseComposer.addPass(finalPass)
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
    scene.fog = new THREE.FogExp2(0xEBE2DB, 0.00003);

    // camera
    camera = new THREE.PerspectiveCamera( 60, window.innerWidth / window.innerHeight, 0.1, 5000000 );
    camera.position.set(0, 500, 500);
    camera.up.set(0, 0, 1);
    camera.lookAt(0, 0, 0);

    // map orbit
    orbit = new MapControls(camera, canvas)
    orbit.enableDamping = true; // an animation loop is required when either damping or auto-rotation are enabled
    orbit.dampingFactor = 0.05;
    orbit.screenSpacePanning = false;
    orbit.minDistance = 1;
    orbit.maxDistance = 16384;
    orbit.maxPolarAngle = (Math.PI / 2) - (Math.PI / 360)

    initRender()
}
function renderPipeline() {

    // Render bloom
    camera.layers.set(BLOOM_LAYER)
    bloomComposer.render()

    // Render overlays
    camera.layers.set(OVERLAY_LAYER)
    overlayComposer.render()

    // Render normal
    camera.layers.set(BASE_LAYER)
    baseComposer.render()

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
    
    // galaxy.updateScale(camera)

    // Run each pass of the render pipeline
    renderPipeline()

    requestAnimationFrame(render)

}
init()
generateGalaxy()
requestAnimationFrame(render)
