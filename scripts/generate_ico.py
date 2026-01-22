"""
生成 Tauri 应用所需的各种尺寸图标（修复版）
"""
from PIL import Image
import os

# 源图片路径
SOURCE_IMG = r"d:\3_Projects\Active\FolderPainter\logo.png"
# 输出目录
OUTPUT_DIR = r"d:\3_Projects\Active\FolderPainter\src-tauri\icons"

# ICO 文件包含的尺寸
ICO_SIZES = [16, 24, 32, 48, 64, 128, 256]

def generate_ico():
    # 打开源图片
    img = Image.open(SOURCE_IMG)
    
    # 确保是 RGBA 模式（支持透明度）
    if img.mode != 'RGBA':
        img = img.convert('RGBA')
    
    print(f"源图片尺寸: {img.size}")
    
    # 生成各种尺寸的图像列表
    ico_images = []
    for size in ICO_SIZES:
        resized = img.resize((size, size), Image.Resampling.LANCZOS)
        ico_images.append(resized)
        print(f"  准备 {size}x{size}")
    
    ico_path = os.path.join(OUTPUT_DIR, "icon.ico")
    
    # 使用第一个图像作为基础，其他作为附加
    # ICO 格式需要特殊处理
    img_256 = img.resize((256, 256), Image.Resampling.LANCZOS)
    
    # 保存时包含所有尺寸
    img_256.save(
        ico_path,
        format='ICO',
        sizes=[(size, size) for size in ICO_SIZES]
    )
    
    print(f"\n✓ 生成 icon.ico")
    
    # 检查文件大小
    file_size = os.path.getsize(ico_path)
    print(f"  文件大小: {file_size:,} 字节")

if __name__ == "__main__":
    generate_ico()
