import fs from 'fs/promises';
import { unscramble } from '../src/utils';

test('process a map with every character and digit', async () => {
	const map = JSON.parse(await fs.readFile('./resources/map.json', 'utf8'));
	const data = unscramble(map);

	expect(data).toEqual([
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
