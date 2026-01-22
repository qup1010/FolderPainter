use std::fs::File;
use std::io::{self, Write, Cursor};
use image::ImageFormat;

/// 生成一个简单的单色 16x16 ICO 图标文件
pub fn generate_solid_color_icon(file_path: &str, r: u8, g: u8, b: u8) -> io::Result<()> {
    let width: u8 = 16;
    let height: u8 = 16;
    let bpp: u16 = 24;

    let pixel_data_size = (width as usize) * (height as usize) * 3;
    let bmp_header_size: u32 = 40;
    let mask_row_size = 4usize;
    let mask_size = mask_row_size * (height as usize);
    let total_size = bmp_header_size as usize + pixel_data_size + mask_size;
    let offset: u32 = 6 + 16;

    let mut data = Vec::with_capacity(6 + 16 + total_size);

    // ICO Header
    data.extend_from_slice(&0u16.to_le_bytes());
    data.extend_from_slice(&1u16.to_le_bytes());
    data.extend_from_slice(&1u16.to_le_bytes());

    // Image Directory Entry
    data.push(width);
    data.push(height);
    data.push(0);
    data.push(0);
    data.extend_from_slice(&1u16.to_le_bytes());
    data.extend_from_slice(&bpp.to_le_bytes());
    data.extend_from_slice(&(total_size as u32).to_le_bytes());
    data.extend_from_slice(&offset.to_le_bytes());

    // BITMAPINFOHEADER
    data.extend_from_slice(&40u32.to_le_bytes());
    data.extend_from_slice(&(width as u32).to_le_bytes());
    data.extend_from_slice(&((height as u32) * 2).to_le_bytes());
    data.extend_from_slice(&1u16.to_le_bytes());
    data.extend_from_slice(&bpp.to_le_bytes());
    data.extend_from_slice(&0u32.to_le_bytes());
    data.extend_from_slice(&(total_size as u32).to_le_bytes());
    data.extend_from_slice(&0u32.to_le_bytes());
    data.extend_from_slice(&0u32.to_le_bytes());
    data.extend_from_slice(&0u32.to_le_bytes());
    data.extend_from_slice(&0u32.to_le_bytes());

    // Pixel Data (BGR format)
    for _ in 0..height {
        for _ in 0..width {
            data.push(b);
            data.push(g);
            data.push(r);
        }
    }

    // AND Mask
    for _ in 0..height {
        data.extend_from_slice(&[0u8; 4]);
    }

    let mut file = File::create(file_path)?;
    file.write_all(&data)?;
    Ok(())
}

/// 从十六进制颜色字符串生成图标
pub fn generate_icon_from_hex(file_path: &str, hex_color: &str) -> io::Result<()> {
    let hex = hex_color.trim_start_matches('#');

    if hex.len() != 6 {
        return Err(io::Error::new(
            io::ErrorKind::InvalidInput,
            "Invalid hex color format. Expected #RRGGBB or RRGGBB",
        ));
    }

    let r = u8::from_str_radix(&hex[0..2], 16)
        .map_err(|e| io::Error::new(io::ErrorKind::InvalidInput, e))?;
    let g = u8::from_str_radix(&hex[2..4], 16)
        .map_err(|e| io::Error::new(io::ErrorKind::InvalidInput, e))?;
    let b = u8::from_str_radix(&hex[4..6], 16)
        .map_err(|e| io::Error::new(io::ErrorKind::InvalidInput, e))?;

    generate_solid_color_icon(file_path, r, g, b)
}

/// 将 PNG 图像字节转换为多尺寸 ICO 文件
///
/// # Arguments
/// * `png_bytes` - PNG 格式的图像数据
/// * `output_path` - 输出 ICO 文件路径
///
/// # Returns
/// * `Ok(())` - 成功
/// * `Err` - 错误信息
pub fn png_to_ico(png_bytes: &[u8], output_path: &str) -> Result<(), String> {
    // 加载 PNG 图像
    let img = image::load_from_memory(png_bytes)
        .map_err(|e| format!("加载图像失败: {}", e))?;

    // 定义 ICO 需要的尺寸
    let sizes: Vec<u32> = vec![256, 128, 64, 48, 32, 16];

    // 创建各尺寸的 PNG 数据
    let mut icon_entries: Vec<(u32, Vec<u8>)> = Vec::new();

    for size in &sizes {
        let resized = img.resize_exact(*size, *size, image::imageops::FilterType::Lanczos3);

        let mut png_data = Vec::new();
        let mut cursor = Cursor::new(&mut png_data);
        resized.write_to(&mut cursor, ImageFormat::Png)
            .map_err(|e| format!("编码 PNG 失败: {}", e))?;

        icon_entries.push((*size, png_data));
    }

    // 构建 ICO 文件
    let ico_data = build_ico_from_pngs(&icon_entries)?;

    // 写入文件
    let mut file = File::create(output_path)
        .map_err(|e| format!("创建文件失败: {}", e))?;
    file.write_all(&ico_data)
        .map_err(|e| format!("写入文件失败: {}", e))?;

    Ok(())
}

/// 从多个 PNG 数据构建 ICO 文件
fn build_ico_from_pngs(entries: &[(u32, Vec<u8>)]) -> Result<Vec<u8>, String> {
    let num_images = entries.len() as u16;

    // 计算文件结构大小
    let header_size = 6usize; // ICO header
    let dir_entry_size = 16usize; // 每个目录条目
    let dir_total_size = dir_entry_size * entries.len();

    // 计算每个图像的偏移量
    let mut current_offset = header_size + dir_total_size;
    let mut offsets: Vec<usize> = Vec::new();
    for (_, png_data) in entries {
        offsets.push(current_offset);
        current_offset += png_data.len();
    }

    let mut ico_data: Vec<u8> = Vec::with_capacity(current_offset);

    // ICO Header (6 bytes)
    ico_data.extend_from_slice(&0u16.to_le_bytes()); // Reserved
    ico_data.extend_from_slice(&1u16.to_le_bytes()); // Type (1 = icon)
    ico_data.extend_from_slice(&num_images.to_le_bytes()); // Number of images

    // Image Directory Entries (16 bytes each)
    for (i, (size, png_data)) in entries.iter().enumerate() {
        // Width (0 means 256)
        ico_data.push(if *size == 256 { 0 } else { *size as u8 });
        // Height (0 means 256)
        ico_data.push(if *size == 256 { 0 } else { *size as u8 });
        // Color palette (0 = no palette)
        ico_data.push(0);
        // Reserved
        ico_data.push(0);
        // Color planes (1 for PNG)
        ico_data.extend_from_slice(&1u16.to_le_bytes());
        // Bits per pixel (32 for PNG with alpha)
        ico_data.extend_from_slice(&32u16.to_le_bytes());
        // Image size in bytes
        ico_data.extend_from_slice(&(png_data.len() as u32).to_le_bytes());
        // Offset from beginning of file
        ico_data.extend_from_slice(&(offsets[i] as u32).to_le_bytes());
    }

    // Image Data (PNG format)
    for (_, png_data) in entries {
        ico_data.extend_from_slice(png_data);
    }

    Ok(ico_data)
}

/// 从 AI 生成的图像创建 ICO 文件
pub fn create_icon_from_ai_image(image_bytes: &[u8], output_path: &str) -> Result<(), String> {
    png_to_ico(image_bytes, output_path)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    #[test]
    fn test_generate_solid_color_icon() {
        let path = "test_icon.ico";
        let result = generate_solid_color_icon(path, 255, 0, 0);
        assert!(result.is_ok());

        let metadata = fs::metadata(path).unwrap();
        assert_eq!(metadata.len(), 894);

        fs::remove_file(path).unwrap();
    }

    #[test]
    fn test_generate_icon_from_hex() {
        let path = "test_hex_icon.ico";
        let result = generate_icon_from_hex(path, "#FF00FF");
        assert!(result.is_ok());

        fs::remove_file(path).unwrap();
    }
}
