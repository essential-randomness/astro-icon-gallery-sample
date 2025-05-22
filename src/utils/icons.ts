import path from "path";
import { readdir } from "fs/promises";

export async function listDirectories(pth) {
  const directories = (await readdir(pth, { withFileTypes: true }))
    .filter((dirent) => dirent.isDirectory())
    .map((dir) => dir.name);

  return directories;
}

export async function getIconImages(iconId: string) {
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

function getCharacters(
  resolvedImages: ImageMetadata[],
  baseGalleryPath: string
) {
  const allFolders = resolvedImages
    .map(({ src }) => {
      const pathInGallery = src.replace("/@fs" + baseGalleryPath + "/", "");
      const firstSlash = pathInGallery.indexOf("/");
      if (firstSlash === -1) {
        return null;
      }
      return pathInGallery.substring(0, firstSlash);
    })
    .filter((x) => x !== null);

  return Array.from(new Set(allFolders));
}

export async function getIconSet(filePath: string) {
  const { dir, name } = path.parse(filePath);
  const galleryPath = path.resolve(dir, name);

  let images = import.meta.glob<{ default: ImageMetadata }>(
    "/src/content/gallery/**/*.{jpeg,jpg,png,gif}"
  );

  console.log(galleryPath);

  // console.log(name);

  // let dirnames = await listDirectories("./src/content/gallery/demo");
  // let names = Array.fromAsync(dirnames);

  // const finalDirNames = Array.from(dirnames);
  // const getImages = getIconImages();

  const resolvedImages = await Promise.all(
    Object.values(images).map((image) => image().then((mod) => mod.default))
  );
  // console.log(resolvedImages.map((img) => img.src));

  const characters = getCharacters(resolvedImages, galleryPath);

  const characterImages: Record<string, ImageMetadata[]> = {};

  for (const character of characters) {
    characterImages[character] = resolvedImages.filter(({ src }) =>
      src.startsWith("/@fs" + path.resolve(galleryPath, character))
    );
  }

  return characterImages;
}
