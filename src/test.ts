
export async function testTest() {

	const images = import.meta.glob<{ default: ImageMetadata }>(
	  "/src/content/gallery/**/*.{jpeg,jpg,png,gif}",
	  { eager: true }
	);

	const resolvedImages = (
	  Object.values(images)
	);

	return resolvedImages;
}
