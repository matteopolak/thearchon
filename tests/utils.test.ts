import fs from 'fs/promises';

import { unscramble } from '../src/utils';

test('process a map with every character and digit', async () => {
	const data: Buffer = JSON.parse(
		await fs.readFile('./resources/map.json', 'utf8'),
	);
	const result = unscramble({
		itemDamage: 0,
		scale: 0,
		icons: [],
		rows: 103,
		columns: 91,
		x: 0,
		y: 0,
		data,
	});

	expect(result).toEqual([
		'0',
		'1',
		'2',
		'3',
		'4',
		'5',
		'6',
		'7',
		'8',
		'9',
		'A',
		'B',
		'C',
		'D',
		'E',
		'F',
		'G',
		'H',
		'I',
		'J',
		'K',
		'L',
		'M',
		'N',
		'O',
		'P',
		'Q',
		'R',
		'S',
		'T',
		'U',
		'V',
		'W',
		'X',
		'Y',
		'Z',
	]);
});
