import Benchmark from 'benchmark';
import fs from 'fs';
import * as utils from './solve_captcha';

import type { RawMapData } from '../src/typings';

const suite = new Benchmark.Suite('captcha_test', {
	async: true,
});

const data: Buffer = JSON.parse(
	fs.readFileSync('./resources/map.json', 'utf8'),
);

function createMap(): RawMapData {
	return {
		itemDamage: 0,
		scale: 0,
		icons: [],
		rows: 103,
		columns: 91,
		x: 0,
		y: 0,
		data: data.slice(),
	};
}

suite
	.add('new_captcha_solver', () => {
		utils.unscramble(createMap());
	})
	.add('unstable_captcha_solver', () => {
		utils.unscrambleMapped(createMap());
	})
	.on('cycle', (event: { target: string }) => {
		console.log(event.target.toString());
	})
	.run();
