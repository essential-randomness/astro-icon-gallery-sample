import type { Loader } from 'astro/loaders';
import { imageMetadata } from 'astro/assets/utils';

export const iconsLoader: Loader = {
    name: 'icons',
    load: async ({ store, logger, parseData, meta, generateDigest }) => {
    	  	let images = import.meta.glob<{ default: ImageMetadata }>(
    	      "/src/content/gallery/**/*.{jpeg,jpg,png,gif}"
    	    );
    	  
    	    images = Object.fromEntries(
    	      Object.entries(images)
    	    );
    	  
    	    const resolvedImages = await Promise.all(
    	      Object.values(images).map((image) => image().then((mod) => mod.default))
    	    );

    	    for (const item of resolvedImages) {
    	    	const data = await parseData({
    	    		id: item.src,
    	    		data: item,
    	    	});

	    	    store.set ({
	    	    	id,
	    	    	data
	    	    });

    	    }
    }
};
