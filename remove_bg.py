from PIL import Image

def remove_white(image_path, output_path):
    img = Image.open(image_path).convert("RGBA")
    datas = img.getdata()

    newData = []
    # Logo colors are baby blue, mint green, and pale yellow. None of them are pure white.
    # We will make anything close to pure white transparent.
    for item in datas:
        # white threshold
        if item[0] > 240 and item[1] > 240 and item[2] > 240:
            newData.append((255, 255, 255, 0))
        else:
            newData.append(item)

    img.putdata(newData)
    img.save(output_path, "PNG")

remove_white(r"C:\Users\Soubw\.gemini\antigravity\brain\586d2f48-7252-4285-943e-d180bf8eabdb\.user_uploaded\media_1786073984963.png", r"C:\Users\Soubw\Downloads\novoproj\public\assets\logo.png")
print("Background removed successfully.")
