import * as THREE from 'three';
import * as ORE from 'ore-three';
import * as CANNON from 'cannon';

import wallVert from './shaders/wall.vs';
import wallFrag from './shaders/wall.fs';

export type PhysicsData = {
	body: CANNON.Body,
	mesh: THREE.Mesh,
	material: THREE.ShaderMaterial
}

export class Wall extends THREE.Object3D {

	private animator: ORE.Animator;

	private cannonWorld: CANNON.World;
	private commonUniforms: ORE.Uniforms;

	private physics: PhysicsData[] = [];

	private disposed: boolean = false;
	private animating: boolean = true;

	constructor( cannonWorld: CANNON.World, parentUniforms: ORE.Uniforms ) {

		super();

		this.cannonWorld = cannonWorld;

		this.commonUniforms = ORE.UniformsLib.mergeUniforms( parentUniforms, {
			tex: {
				value: null
			},
			uNoiseTex: window.gManager.assetManager.getTex( 'noise' )
		} );

		/*-------------------------------
			Animator
		-------------------------------*/

		this.animator = window.gManager.animator;

		this.commonUniforms.uVisibility = this.animator.add( {
			name: 'wallVisibility',
			initValue: 1,
		} );

	}

	public setTex( texture: THREE.Texture ) {

		this.commonUniforms.tex.value = texture;

	}

	public init( camera: THREE.PerspectiveCamera ) {

		let parent = this;
		let distance = 2.0;

		let height = Math.tan( camera.fov / 2 * THREE.MathUtils.DEG2RAD ) * 2.0 * distance;
		let width = height * camera.aspect;

		let cameraWorldPos = camera.getWorldPosition( new THREE.Vector3() );
		let position = parent.worldToLocal( cameraWorldPos.clone().add( camera.getWorldDirection( new THREE.Vector3() ).normalize().multiplyScalar( distance ) ) );

		let mesh = new THREE.Mesh( new THREE.PlaneGeometry( width, height ), new THREE.MeshNormalMaterial( { wireframe: true } ) );
		mesh.position.copy( position );
		mesh.lookAt( parent.worldToLocal( cameraWorldPos ) );

		/*-------------------------------
			Mesh
		-------------------------------*/

		let globalSize = new THREE.Vector3( width, height, 0.15 );
		let res = new THREE.Vector2( globalSize.x, globalSize.y ).multiplyScalar( 5 ).round();
		let size = new THREE.Vector2( globalSize.x / res.x, globalSize.y / res.y );

		const heartShape = new THREE.Shape();
		const x = 0, y = 0;
		heartShape.moveTo( x + 5, y + 5 );
		heartShape.bezierCurveTo( x + 5, y + 5, x + 4, y, x, y );
		heartShape.bezierCurveTo( x - 6, y, x - 6, y + 7,x - 6, y + 7 );
		heartShape.bezierCurveTo( x - 6, y + 11, x - 3, y + 15.4, x + 5, y + 19 );
		heartShape.bezierCurveTo( x + 12, y + 15.4, x + 16, y + 11, x + 16, y + 7 );
		heartShape.bezierCurveTo( x + 16, y + 7, x + 16, y, x + 10, y );
		heartShape.bezierCurveTo( x + 7, y, x + 5, y + 5, x + 5, y + 5 );

		const extrudeSettings = {
			depth: globalSize.z,
			bevelEnabled: false
		};

		for ( let i = 0; i < res.x; i ++ ) {

			for ( let j = 0; j < res.y; j ++ ) {

				let geo = new THREE.ExtrudeGeometry( heartShape, extrudeSettings );
				geo.scale( size.x / 16, size.y / 19, 1 ); // Scale to fit the original box dimensions

				let uv = geo.getAttribute( 'uv' );
				uv.applyMatrix4( new THREE.Matrix4().makeScale( 5.0 / res.x, 5.0 / res.y, 5 ) );
				uv.applyMatrix4( new THREE.Matrix4().makeTranslation( 5.0 / res.x * i, 5.0 / res.y * j, 0.0 ) );

				let boxBody = new CANNON.Body( {
					mass: 1,
					allowSleep: true,
				} );

				let boxMat = new THREE.ShaderMaterial( {
					vertexShader: wallVert,
					fragmentShader: wallFrag,
					uniforms: ORE.UniformsLib.mergeUniforms( this.commonUniforms, {
						velocity: {
							value: boxBody.velocity
						}
					} ),
				} );

				let boxMesh = new THREE.Mesh( geo, boxMat );
				this.add( boxMesh );

				boxBody.sleep();
				boxBody.sleepSpeedLimit = 0.1;
				boxBody.sleepTimeLimit = 1;

				let pos = new THREE.Vector3( size.x / 2 + i * size.x - ( globalSize.x / 2 ), size.y / 2 + j * size.y - ( globalSize.y / 2 ), - globalSize.z / 2 );
				pos.applyQuaternion( mesh.quaternion );
				pos.add( mesh.position );

				// @ts-ignore
				boxBody.name = i + '-' + j;
				boxBody.position.set( pos.x, pos.y, pos.z );
				boxBody.quaternion.copy( mesh.quaternion as unknown as CANNON.Quaternion );
				boxBody.addShape( new CANNON.Box( new CANNON.Vec3( size.x / 2, size.y / 2, globalSize.z / 2 ) ) );

				this.cannonWorld.addBody( boxBody );

				this.physics.push( {
					mesh: boxMesh,
					body: boxBody,
					material: boxMat
				} );

			}

		}

	}

	public update( deltaTime: number ) {

		if ( ! this.animating ) return;

		for ( let i = 0; i < this.physics.length; i ++ ) {

			let mesh = this.physics[ i ].mesh;
			let body = this.physics[ i ].body;
			let mat = this.physics[ i ].material;

			mesh.position.copy( body.position as unknown as THREE.Vector3 );
			mesh.quaternion.copy( body.quaternion as unknown as THREE.Quaternion );

		}

	}

	public dispose() {

		if ( this.disposed ) return;

		this.animator.animate( 'wallVisibility', 0, 1, () => {

			this.visible = false;
			this.animating = false;

			this.physics.forEach( item => {

				this.remove( item.mesh );
				item.mesh.geometry.dispose();
				item.material.dispose();

			} );

			this.physics.length = 0;

		} );

	}

	public switchVisibility( visible: boolean ) {

		this.animator.animate( 'wallVisibility', visible ? 1 : 0, 1, () => {

			this.visible = visible;
			this.animating = visible;

		} );

	}

}
