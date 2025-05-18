import path from "path";
import {readdir} from 'fs/promises';

export async function listDirectories(pth) {
  const directories = (await readdir(pth, {withFileTypes: true}))
    .filter(dirent => dirent.isDirectory())
    .map(dir => dir.name);

  return directories;
}

export async function getIconImages(iconId: string) {;

  let images = import.meta.glob<{ default: ImageMetadata }>(
    "/src/content/gallery/**/*.{jpeg,jpg,png,gif}"
  );

  images = Object.fromEntries(
    Object.entries(images).filter(([key]) => key.includes(iconId))
  );

  const resolvedImages = await Promise.all(
    Object.values(images).map((image) => image().then((mod) => mod.default))
  );
  
  return resolvedImages;
}

export async function getIconSet(name: string) {
	let images = import.meta.glob<{ default: ImageMetadata }>(
	    "/src/content/gallery/**/*.{jpeg,jpg,png,gif}"
	);
	
	let dirnames = await listDirectories("./src/content/gallery/kamen-rider-gotchard");
	let names = Array.fromAsync(dirnames);

	const finalDirNames = Array.from(dirnames);
	const getImages = getIconImages();

	const resolvedImages = await Promise.all(
	    Object.values(images).map((image) => image().then((mod) => mod.default))
	  );

	const finalImages = resolvedImages.filter(({ src }) => src.includes(name));

	return finalImages;
}
