const button = document.querySelector<HTMLButtonElement>("#inc");

let count = 0;
button?.addEventListener("click", () => {
  count += 1;
  button.textContent = `count is ${count}`;
});
