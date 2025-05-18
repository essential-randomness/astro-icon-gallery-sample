import type { Loader } from 'astro/loaders';

import fs from 'fs';

export const picsLoader: Loader = {
    name: 'pics',
    load: async (context) => {
		const photoData = fs.readFileSync("output.json", (err) => err && console.error(err));
		const json = await photoData.json();

        context.logger.info(JSON.stringify(json));
    },
};
