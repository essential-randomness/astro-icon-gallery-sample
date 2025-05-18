let loadedCount = 0;
const batchSize = 24;
const container = document.querySelector(".image-grid");
let photos = [];

const addPhotos = () => {
  const photoSlice = photos.slice(loadedCount, batchSize);
  let content = "";
  photoSlice.forEach((item) => {
    content += `
        <a href="#"><Image src="${item.file}" alt="${item.caption}" title="${item.caption}" width="100" loading="lazy" /></a>
    `;
  });
  container.innerHTML += content;
  loadedCount += batchSize;
}

const initPhotos = async () => {
  const photoData = await fetch("kamen-rider-gotchard.json");
  photos = await photoData.json();
        
  addPhotos();
        
  document.querySelector("main").addEventListener('load', () => {
    observer = new IntersectionObserver(() => {
      addPhotos();
    });
    observer.observe(document.querySelector("footer"));
  });
}

initPhotos();
