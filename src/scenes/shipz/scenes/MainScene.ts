import { Vector2 } from 'ver/Vector2';
import { math as Math } from 'ver/helpers';
import { Animation } from 'ver/Animation';
import type { Viewport } from 'ver/Viewport';
import { Loader } from 'ver/Loader';

import { SensorCamera } from 'engine/SensorCamera.js';
import { Joystick } from 'engine/scenes/gui/Joystick.js';
import { GridMap } from 'engine/scenes/gui/GridMap.js';
import { Control } from 'engine/scenes/Control.js';
import { Node2D } from 'engine/scenes/Node2D.js';
import { Camera2D } from 'engine/scenes/Camera2D.js';
import { SystemInfo } from 'engine/scenes/gui/SystemInfo.js';
import { Sprite } from 'engine/scenes/Sprite.js';
import { Ship } from './Ship.js';

import { touches, viewport } from 'src/canvas.js';
import { audioContorller } from '../state.js';


const vec1 = new Vector2(1, 0).normalize(100).set();
const vec2 = new Vector2(1, 0).normalize(100).set();
const vec3 = new Vector2(1, 0).normalize(100).set();


class Info extends Node2D {
	public self!: MainScene;
	protected override async _init(): Promise<void> { this.draw_distance = Math.INF; }
	protected override _ready(): void { this.zIndex = 10000; }

	protected override _draw({ ctx, size }: Viewport): void {
		const center = Vector2.ZERO;
		const a = 30;

		ctx.save();
		ctx.beginPath();
		ctx.globalAlpha = 0.2;
		ctx.strokeStyle = '#ffff00';
		ctx.moveTo(center.x, center.y-a);
		ctx.lineTo(center.x, center.y+a);
		ctx.moveTo(center.x-a, center.y);
		ctx.lineTo(center.x+a, center.y);
		ctx.stroke();
		ctx.restore();


		ctx.save();
		ctx.resetTransform();
		ctx.globalAlpha = 0.5;
		ctx.lineWidth = 5;

		const c = size.new().div(2);

		const v1 = c.new().add(vec1);
		ctx.beginPath();
		ctx.strokeStyle = 'red';
		ctx.moveTo(c.x, c.y);
		ctx.lineTo(v1.x, v1.y);
		ctx.stroke();

		const v2 = c.new().add(vec2);
		ctx.beginPath();
		ctx.strokeStyle = 'green';
		ctx.moveTo(c.x, c.y);
		ctx.lineTo(v2.x, v2.y);
		ctx.stroke();

		const v3 = c.new().add(vec3);
		ctx.beginPath();
		ctx.strokeStyle = 'blue';
		ctx.moveTo(c.x, c.y);
		ctx.lineTo(v3.x, v3.y);
		ctx.stroke();
		ctx.restore();
	}
}


let crosshair_target_size = new Vector2();
let current_crosshair: number = 1;

const loadCrosshair = async (i: number) => Loader.instance().loadImage(`assets/crosshair/PNG/Outline/crosshair${i.toString().padStart(3, '0')}.png`);


const moveTime_anim = new Animation(function* (target: Vector2, value: Vector2) {
	value.set(target);
	yield 300; while(value.getDistance(Vector2.ZERO) > 1) { value.moveTime(Vector2.ZERO, 10); yield 10; }
});

export class MainScene extends Control {
	protected static override async _load(scene: typeof this): Promise<void> {
		await Promise.all([
			Sprite.load(),
			super._load(scene)
		]);
	}

	public override TREE() { return {
		Camera2D,
		GridMap,
		SystemInfo,
		Info,
		Joystick,
		Back: Sprite,
		Ship,
		Crosshair: Sprite
	}}
	// aliases
	public get $camera() { return this.get('Camera2D'); }
	public get $gridMap() { return this.get('GridMap'); }
	public get $info() { return this.get('Info'); }
	public get $joystick() { return this.get('Joystick'); }
	public get $ship() { return this.get('Ship'); }
	public get $crosshair() { return this.get('Crosshair'); }

	public sensor_camera = new SensorCamera();

	protected override async _init(this: MainScene): Promise<void> {
		await super._init();

		this.$camera.viewport = viewport;
		this.$camera.current = true;
		this.$camera.on('PreProcess', dt => {
			this.$camera.position.moveTime(this.$ship.position.new(), 5);

			// this.sensor_camera.update(dt, touches, this.$camera);

			this.$gridMap.scroll.set(this.$camera.position);
			this.$gridMap.position.set(this.$camera.position);
			this.$gridMap.size.set(this.$camera.size.new().inc(this.$camera.scale));
		});

		this.$gridMap.tile.set(100, 100);
		this.$info.self = this;

		await audioContorller.load('click', 'assets/audio/play.wav');


		await this.get('Back').load('assets/img/island-paradise.jpg');
		this.get('Back').scale.set(2);
		this.get('Back').on('PreRender', ({ ctx }) => ctx.imageSmoothingQuality = 'low');


		this.$crosshair.on('PreRender', ({ ctx }) => ctx.imageSmoothingEnabled = false);


		loadCrosshair(current_crosshair).then(img => {
			this.$crosshair.image = img;
			crosshair_target_size.set(this.$crosshair.width, this.$crosshair.height);
		});


		viewport.on('resize', size => {
			const s = size.new().div(2);

			this.$joystick.position.set(-(s.x - 100), s.y - 100);
		}).call(viewport, viewport.size);
	}

	protected override _ready(this: MainScene): void {
		this.processPriority = 1000;

		this.$camera.addChild(this.removeChild(this.$joystick.name, true));
	}

	protected override _process(this: MainScene, dt: number): void {
		moveTime_anim.tick(dt);


		const ship = this.$ship;
		const joystick = this.$joystick;


		let touch = touches.findTouch();
		if(joystick.touch !== touch && touch) {
			const pos = viewport.transformFromScreenToViewport(touch.pos.new());

			current_crosshair += 1;
			loadCrosshair(current_crosshair).then(img => {
				this.$crosshair.image = img;

				this.$crosshair.position.set(pos);

				moveTime_anim.reset().run(crosshair_target_size, this.$crosshair.size)
					.then(() => ship.gun_target = null);
			});

			ship.shoot(pos);
		}


		const speed = 0.2;
		const angular_speed = 0.002;

		if(!joystick.value) ship.state('idle');
		else {
			ship.state('running');

			const dir = Math.mod(joystick.angle - ship.rotation, -Math.PI, Math.PI);
			ship.angular_velosity += angular_speed * dir;

			ship.velosity.moveAngle(dt/16 * speed * joystick.value, ship.rotation);
		}
	}
}
