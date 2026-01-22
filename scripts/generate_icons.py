"""
生成 Tauri 应用所需的各种尺寸图标
"""
from PIL import Image
import os

# 源图片路径
SOURCE_IMG = r"d:\3_Projects\Active\FolderPainter\image-.png"
# 输出目录
OUTPUT_DIR = r"d:\3_Projects\Active\FolderPainter\src-tauri\icons"

# Tauri 需要的图标尺寸
ICON_SIZES = {
    # 标准 PNG 图标
    "32x32.png": 32,
    "128x128.png": 128,
    "128x128@2x.png": 256,
    "icon.png": 512,
    
    # Windows Store Logo
    "Square30x30Logo.png": 30,
    "Square44x44Logo.png": 44,
    "Square71x71Logo.png": 71,
    "Square89x89Logo.png": 89,
    "Square107x107Logo.png": 107,
    "Square142x142Logo.png": 142,
    "Square150x150Logo.png": 150,
    "Square284x284Logo.png": 284,
    "Square310x310Logo.png": 310,
    "StoreLogo.png": 50,
}

# ICO 文件包含的尺寸
ICO_SIZES = [16, 24, 32, 48, 64, 128, 256]

def generate_icons():
    # 打开源图片
    img = Image.open(SOURCE_IMG)
    
    # 确保是 RGBA 模式（支持透明度）
    if img.mode != 'RGBA':
        img = img.convert('RGBA')
    
    print(f"源图片尺寸: {img.size}")
    print(f"输出目录: {OUTPUT_DIR}")
    print("-" * 40)
    
    # 生成各种尺寸的 PNG
    for filename, size in ICON_SIZES.items():
        output_path = os.path.join(OUTPUT_DIR, filename)
        resized = img.resize((size, size), Image.Resampling.LANCZOS)
        resized.save(output_path, "PNG")
        print(f"✓ 生成 {filename} ({size}x{size})")
    
    # 生成 ICO 文件
    ico_images = []
    for size in ICO_SIZES:
        resized = img.resize((size, size), Image.Resampling.LANCZOS)
        ico_images.append(resized)
    
    ico_path = os.path.join(OUTPUT_DIR, "icon.ico")
    # 保存 ICO（包含多种尺寸）
    ico_images[0].save(
        ico_path,
        format='ICO',
        sizes=[(s, s) for s in ICO_SIZES],
        append_images=ico_images[1:]
    )
    print(f"✓ 生成 icon.ico (包含 {len(ICO_SIZES)} 种尺寸)")
    
    print("-" * 40)
    print("🎉 所有图标生成完成！")

if __name__ == "__main__":
    generate_icons()
