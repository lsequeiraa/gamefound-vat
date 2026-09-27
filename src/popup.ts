import { getEnabled, setEnabled } from "./settings";

const checkbox = document.getElementById("enabled") as HTMLInputElement;
void getEnabled().then((enabled) => {
  checkbox.checked = enabled;
});
checkbox.addEventListener("change", () => void setEnabled(checkbox.checked));
