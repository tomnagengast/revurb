export default {
	default: "reverb",
	servers: {
		reverb: {
			host: "0.0.0.0",
			port: 8080,
		},
	},
	apps: {
		provider: "config",
		apps: [
			{
				app_id: "my-app-id",
				key: "my-app-key",
				secret: "my-app-secret",
				allowed_origins: ["*"],
			},
		],
	},
};
