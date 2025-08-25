import json
import os

# Boya / değişen mantığı
def parse_car_status(user_text, data):
    boya_degisen_options = {
        "boyasız": ["Boyasız"],
        "değişensiz": ["Değişensiz"],
        "tramersiz": ["Tramersiz"],
        "hatasız": ["Boyasız", "Değişensiz", "Tramersiz"],
        "boyasız ve değişensiz": ["Boyasız", "Değişensiz"]
    }
    
    original_value = data['assistant'].get('boya_degişen_parca', [])
    data['assistant']['boya_degişen_parca'] = []

    if "hatasız" in user_text:
        data['assistant']['boya_degişen_parca'] = boya_degisen_options['hatasız']
    elif "boyasız ve değişensiz" in user_text:
        data['assistant']['boya_degişen_parca'] = boya_degisen_options['boyasız ve değişensiz']
    else:
        for keyword, value in boya_degisen_options.items():
            if keyword in user_text and keyword not in ["hatasız", "boyasız ve değişensiz"]:
                if keyword == "boyasız":
                    data['assistant']['boya_degişen_parca'].append(value[0])
                else:
                    data['assistant']['boya_degişen_parca'].extend(value)
    
    data['assistant']['boya_degişen_parca'] = list(dict.fromkeys(data['assistant']['boya_degişen_parca']))

    return data, (original_value != data['assistant']['boya_degişen_parca'])


# Siralama mantığı
def correct_siralama(user_text, assistant_data):
    sorting_keywords = [
        "en ucuz", "ekonomik", "en pahalı", "lüks", "en düşük kilometreli",
        "az kilometreli", "düşük km'li", "en düşük km'li", "yüksek km olmasın",
        "en yeni", "sırala", "sıralansın", "göre sırala", "fiyatı en",
        "en üstte getir", "yeni ilanlar"
    ]
    
    current_siralama = assistant_data.get("siralama")
    if current_siralama:
        has_sorting_keyword = any(keyword in user_text for keyword in sorting_keywords)
        if not has_sorting_keyword:
            assistant_data["siralama"] = ""
            return True
    return False


# Yıl kuralı: 2025 yoksa Sıfır ve Yetkili Bayiden Sıfır olamaz
def enforce_arac_durumu_year_rule(assistant_data):
    min_yil = assistant_data.get("minYil")
    max_yil = assistant_data.get("maxYil")
    # 2025 içermiyorsa kaldır
    contains_2025 = (min_yil == 2025) or (max_yil == 2025)
    if contains_2025:
        return False

    original = list(assistant_data.get("arac_durumu", []))
    invalid = {"Sıfır", "Yetkili Bayiden Sıfır"}
    cleaned = [v for v in original if v not in invalid]
    if cleaned != original:
        assistant_data["arac_durumu"] = cleaned
        return True
    return False


def load_json_with_fix(file_path):
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            raw = f.read()

        # Python literal → JSON literal
        fixed_raw = raw.replace("None", "null").replace("True", "true").replace("False", "false")
        return json.loads(fixed_raw)

    except json.JSONDecodeError:
        print(f"Geçersiz JSON atlandı: {os.path.basename(file_path)}")
        return None


def merge_and_process_json_files(folder_path, output_path):
    all_data = []
    siralama_fix_count = 0
    boya_fix_count = 0
    arac_durumu_fix_count = 0

    for filename in os.listdir(folder_path):
        if filename.lower().endswith(".json"):
            file_path = os.path.join(folder_path, filename)
            data = load_json_with_fix(file_path)
            if not data:
                continue

            for entry in data:
                user_text = entry.get('user', "").lower()
                assistant_data = entry.get('assistant', {})

                # Siralama düzeltme
                if correct_siralama(user_text, assistant_data):
                    siralama_fix_count += 1

                # Yıl kuralı ile araç durumu düzeltme
                if enforce_arac_durumu_year_rule(assistant_data):
                    arac_durumu_fix_count += 1

                # Boya / değişen düzeltme
                updated_entry, boya_changed = parse_car_status(user_text, entry)
                if boya_changed:
                    boya_fix_count += 1

                all_data.append(updated_entry)

    # JSON listesi olarak yaz her obje ayrı satır
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write("[\n")
        for i, entry in enumerate(all_data):
            f.write(json.dumps(entry, ensure_ascii=False))
            if i < len(all_data) - 1:
                f.write(",\n")
            else:
                f.write("\n")
        f.write("]")

    print(f"Toplam {siralama_fix_count} kayıt 'siralama' alanında düzeltildi.")
    print(f"Toplam {arac_durumu_fix_count} kayıt 'arac_durumu' yıl kuralına göre düzeltildi.")
    print(f"Toplam {boya_fix_count} kayıt 'boya_degişen_parca' alanında düzeltildi.")
    print(f"Toplam {len(all_data)} kayıt işlendi ve birleştirildi.")


# Kullanım
input_folder = r"C:\Users\yineh\OneDrive\Masaüstü\ilk"
output_file = r"C:\Users\yineh\OneDrive\Masaüstü\birlesmis_duzenlenmis.json"

merge_and_process_json_files(input_folder, output_file)
