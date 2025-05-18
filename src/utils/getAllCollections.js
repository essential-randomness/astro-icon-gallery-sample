import { getCollection } from 'astro:content';
import { collectionNames } from '../content.config.ts';

export default async function getAllCollections() {
  const collections = await Promise.all(
    collectionNames.map((name) => getCollection(name))
  );
  return collections.flat();
}
