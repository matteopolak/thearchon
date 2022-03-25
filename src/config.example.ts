type AuthType = 'mojang' | 'microsoft';
type ServerType = 'onyx' | 'ruby' | 'amber' | 'chaos' | 'genesis' | 'origins';

interface Config {
	fishOnJoin: boolean;
	sneakWhileFishing: boolean;
	upgradeFishingRodAutomatically: boolean;
	server: ServerType;
	whitelist: string[];
	autopay_to: string;
	log: boolean;
	version: string;
	accounts: {
		alias: string;
		username: string;
		password: string;
		auth: AuthType;
	}[];
}

const config: Config = {
	fishOnJoin: true,
	server: 'onyx',
	sneakWhileFishing: false,
	upgradeFishingRodAutomatically: true,
	whitelist: ['main_account', 'anoter_account'],
	autopay_to: 'main_account',
	log: true,
	version: '1.12.2',
	accounts: [
		{
			alias: 'username1',
			username: 'email1@gmail.com',
			password: 'password1',
			auth: 'mojang',
		},
		{
			alias: 'username2',
			username: 'microsoft@outlook.com',
			password: 'password2',
			auth: 'microsoft',
		},
	],
};

export default config;
