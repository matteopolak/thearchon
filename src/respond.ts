import { generateActions, generateResponse } from './utils';

async function run(message: string | undefined) {
	if (message === undefined) {
		console.log('Usage: npm run respond -- <message>');

		process.exit(0);
	}

	const [response, actions] = await Promise.all([
		generateResponse(message),
		generateActions(message),
	]);

	console.log(`
Response: ${response ?? 'None'}
Actions: ${
		actions.length
			? actions.map(a => `${a.direction}(${a.distance})`).join(', ')
			: 'None'
	}`);
}

run(process.argv[2]);
