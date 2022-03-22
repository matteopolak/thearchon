import Benchmark from 'benchmark';
import fs from 'fs';
import * as utils from './solve_captcha';

import type { RawMapData } from '../src/typings';

const suite = new Benchmark.Suite();

const data: Buffer = JSON.parse(
	fs.readFileSync('./resources/map_flat.json', 'utf8'),
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
	.add('old_captcha_solver', () => {
		utils.unscrambleOld(utils.formatMapDataOld(createMap()));
	})
	.add('new_captcha_solver', () => {
		utils.unscrambleNew(createMap());
	})
	.on('cycle', (event: { target: string }) => {
		console.log(event.target.toString());
	})
	.on('complete', () => {
		console.log(`Fastest is ${suite.filter('fastest').map('name')}`);
	})
	.run({ async: true });
