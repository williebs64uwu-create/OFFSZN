using System;
using System.IO;
using System.Threading.Tasks;
using Windows.Media.Ocr;
using Windows.Storage;
using Windows.Graphics.Imaging;
using Windows.Storage.Streams;

class OcrApp {
    static void Main(string[] args) {
        if (args.Length < 2) {
            Console.WriteLine("Usage: OcrApp <images_dir> <output_file>");
            return;
        }
        string dir = args[0];
        string outFile = args[1];
        ProcessOcr(dir, outFile).GetAwaiter().GetResult();
    }
    
    static async Task ProcessOcr(string dir, string outFile) {
        var engine = OcrEngine.TryCreateFromUserProfileLanguages();
        if (engine == null) {
            Console.WriteLine("Error: Could not create OcrEngine.");
            return;
        }
        
        using (var writer = new StreamWriter(outFile, false, System.Text.Encoding.UTF8)) {
            var files = Directory.GetFiles(dir, "*.png");
            Array.Sort(files, new ImageComparer());
            
            foreach (var f in files) {
                Console.WriteLine("Processing " + Path.GetFileName(f) + "...");
                writer.WriteLine("========================================");
                writer.WriteLine("IMAGE: " + Path.GetFileName(f));
                writer.WriteLine("========================================");
                
                try {
                    StorageFile file = await StorageFile.GetFileFromPathAsync(f);
                    using (IRandomAccessStream stream = await file.OpenAsync(FileAccessMode.Read)) {
                        BitmapDecoder decoder = await BitmapDecoder.CreateAsync(stream);
                        using (SoftwareBitmap bitmap = await decoder.GetSoftwareBitmapAsync()) {
                            OcrResult result = await engine.RecognizeAsync(bitmap);
                            writer.WriteLine(result.Text);
                        }
                    }
                } catch (Exception ex) {
                    writer.WriteLine("Error processing " + Path.GetFileName(f) + ": " + ex.Message);
                }
                writer.WriteLine();
                writer.WriteLine();
            }
        }
        Console.WriteLine("OCR process finished. Output written to " + outFile);
    }
}

class ImageComparer : System.Collections.IComparer {
    public int Compare(object x, object y) {
        string sx = Path.GetFileNameWithoutExtension((string)x).Replace("image", "");
        string sy = Path.GetFileNameWithoutExtension((string)y).Replace("image", "");
        int ix, iy;
        if (int.TryParse(sx, out ix) && int.TryParse(sy, out iy)) {
            return ix.CompareTo(iy);
        }
        return string.Compare((string)x, (string)y);
    }
}
