import { addListener, sendMsg } from "./connection.js";
import { loadWorkflow } from "./manager.js";
import { app as app } from "../../../scripts/app.js";
import { api as api } from "../../../scripts/api.js";

let photoshopNode = [];
let disabledrow = false;
let firstload = true;
let pluginver = null;
const image = await api.fetchApi(`/PSinputs/PS_canvas.png`);

// تابع برای تنظیم پس‌زمینه نود
function setBackgroundImageContain(node, url) {
  fetch(url, { method: "HEAD" })
    .then((response) => {
      if (response.ok) {
        const img = new Image();
        img.src = url;

        const drawImage = () => {
          if (!disabledrow) {
            // چک کردن پراپرتی "Disable Preview"
            if (node.properties && node.properties["Disable Preview"]) {
              node.onDrawBackground = null; // غیر فعال کردن رسم تصویر
              node.setDirtyCanvas(true, true); // به روزرسانی بوم
              return;
            }

            const aspectRatio = img.width / img.height;
            const nodeAspectRatio = node.size[0] / node.size[1];

            let drawWidth, drawHeight, drawX, drawY;
            if (aspectRatio > nodeAspectRatio) {
              drawWidth = node.size[0];
              drawHeight = drawWidth / aspectRatio;
              drawX = 0;
              drawY = node.size[1] - drawHeight;
            } else {
              drawHeight = node.size[1];
              drawWidth = drawHeight * aspectRatio;
              drawX = (node.size[0] - drawWidth) / 2;
              drawY = 0;
            }

            node.onDrawBackground = function (ctx) {
              ctx.drawImage(img, drawX, drawY, drawWidth, drawHeight);
            };
            node.setDirtyCanvas(true, true);
          }
        };

        img.onload = drawImage;
        img.onerror = () => {
          console.error("Failed to load image:", url);
        };
        node.onResize = drawImage;
      } else {
        node.onDrawBackground = null;
        node.setDirtyCanvas(true, true);
      }
    })
    .catch((error) => {
      console.error("🔹 Error:", error);
      node.onDrawBackground = null;
      node.setDirtyCanvas(true, true);
    });
}

async function previewonthenode() {
  photoshopNode.forEach((node) => {
    const timestamp = new Date().getTime();
    const imageUrl = `${image.url}?v=${timestamp}`;
    setBackgroundImageContain(node, imageUrl);
    console.log("imageUrl: ", imageUrl);
  });
}

function drawUpdateTextAndRoundedStroke(ctx, node) {
  ctx.fillStyle = "blue";
  ctx.font = "bold 32px Arial";
  ctx.textAlign = "center";
  ctx.fillText("Update Available!", node.size[0] / 2, -45);

  const radius = 8;
  const offsetY = -28;
  ctx.strokeStyle = "blue";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(radius, offsetY);
  ctx.lineTo(node.size[0] - radius, offsetY);
  ctx.arcTo(node.size[0], offsetY, node.size[0], radius + offsetY, radius);
  ctx.lineTo(node.size[0], node.size[1] - radius);
  ctx.arcTo(node.size[0], node.size[1], node.size[0] - radius, node.size[1], radius);
  ctx.lineTo(radius, node.size[1]);
  ctx.arcTo(0, node.size[1], 0, node.size[1] - radius, radius);
  ctx.lineTo(0, radius + offsetY);
  ctx.arcTo(0, offsetY, radius, offsetY, radius);
  ctx.closePath();
  ctx.stroke();
}

function createWatchedObject(obj, onChange) {
  return new Proxy(obj, {
    set(target, property, value) {
      if (target[property] !== value) {
        target[property] = value;
        onChange(property, value);
      }
      return true;
    },
  });
}

async function addBooleanProperty(node) {
  if (!node.properties) {
    node.properties = {};
  }

  const properties = {
    "Disable Preview": false,
    "Dont Hide Buttons": false,
  };

  node.properties = createWatchedObject(properties, async (property, newValue) => {
    if (property === "Disable Preview") {
      const timestamp = new Date().getTime();
      const imageUrl = `${image.url}?v=${timestamp}`;
      setBackgroundImageContain(node, imageUrl);
      console.log("imageUrl: ", imageUrl);
    }
  });
}

function addRemoveButtons(node, add) {
  try {
    if (add) {
      addButton(node, "Load SD 1.5", "temp-button", () => loadWorkflow("sd15_workflow"));
      addButton(node, "Load sdxl (coming Soon...)", "temp-button", () => alert("We will dop it this week!"));
    } else {
      node.widgets = node.widgets.filter((widget) => widget.className !== "temp-button");
      node.setDirtyCanvas(true, true);
    }
  } catch (error) {
    console.error("🔹 Error in addRemoveButtons:", error);
  }
}

function handleMouseEvents(node) {
  node.onMouseEnter = () => {
    const tempButtonExists = node.widgets && node.widgets.some((widget) => widget.className === "temp-button");
    if (!tempButtonExists) {
      addRemoveButtons(node, true);
    }
  };
  node.onMouseLeave = () => {
    if (!node.properties || !node.properties["Dont Hide Buttons"]) {
      addRemoveButtons(node, false);
    }
  };
}

// Register extension with ComfyUI
app.registerExtension({
  name: "PhotoshopToComfyUINode2",
  async nodeCreated(node) {
    try {
      if (node?.comfyClass === "🔹Photoshop ComfyUI Plugin") {
        firstload = true;
        photoshopNode.push(node);
        previewonthenode();
        addBooleanProperty(node);
        handleMouseEvents(node);

        if (node.properties && node.properties["Dont Hide Buttons"]) {
          addRemoveButtons(node, true);
        }
        document.getElementsByClassName("comfy-close-menu-btn")[0].click();
        document.getElementById("comfy-view-queue-button").click();
      }
    } catch (error) {
      console.error("🔹 Error in nodeCreated:", error);
    }
  },
});
api.addEventListener("execution_start", () => previewonthenode());

let versionUrl = "https://raw.githubusercontent.com/NimaNzrii/comfyui-photoshop/main/data/PreviewFiles/version.json";

const checkForNewVersion = async (pluginVersion) => {
  try {
    const response = await fetch(versionUrl);
    if (!response.ok) {
      throw new Error("Failed to fetch version information");
    }
    const data = await response.json();
    const latestVersion = data.version;
    console.log("🔹 latestVersion: ", latestVersion);
    const forceUpdate = data.force_update;

    if (latestVersion > pluginVersion) {
      console.log(`🔹 New version available: ${latestVersion}`);

      if (forceUpdate) {
        photoshopNode.forEach((node) => {
          const existingButton = node.widgets?.find((widget) => widget.className === "update-ps-plugin-button");
          if (!existingButton) {
            const originalSize = [...node.size];
            addButton(node, "Click Here To Update🔥", "update-button", () => sendMsg("pullupdate", true));
            node.size = originalSize;

            const originalDrawForeground = node.onDrawForeground;
            node.onDrawForeground = function (ctx) {
              if (originalDrawForeground) originalDrawForeground.call(this, ctx);
              drawUpdateTextAndRoundedStroke(ctx, this);
            };
          }
        });
      } else {
        console.log("You are using the latest version.");
      }
    }
  } catch (error) {
    console.error("🔹 Error checking for new version:", error);
  }
};

function addButton(node, btntxt, class__name, func) {
  try {
    disabledrow = true;
    const originalSize = [...node.size];
    const button = node.addWidget("button", btntxt, null, func);
    button.className = class__name;
    const afterbtnHeight = node.size[1];
    if (originalSize[1] < afterbtnHeight) node.size = [originalSize[0], afterbtnHeight];
    else node.size = originalSize;
    node.setDirtyCanvas(true, true);
    disabledrow = false;
    node.onResize();
  } catch (error) {
    console.error("🔹 Error in addButton:", error);
  }
}

addListener("pluginver", (data) => {
  pluginver = data;
  console.log("pluginver: ", pluginver);
  checkForNewVersion(pluginver);
});
