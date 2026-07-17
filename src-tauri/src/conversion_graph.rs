// CONVERSION GRAPH MODULE
//
// This module defines the conversion path finder. Since we have multiple 
// engines (ffmpeg, imagemagick, pandoc, libreoffice, python, xpdf) that can
// convert between specific formats, we build an adjacency list representing
// possible conversions and perform a BFS search to find the shortest converter chain.
//
// Rust concepts you will learn here:
// - Custom Structs and Struct initialization (Chapter 5)
// - HashMaps (`std::collections::HashMap`) and Vectors (`Vec<T>`) (Chapter 8)
// - Enums for type safety (Chapter 6)
// - Implementing algorithms (BFS) in Rust (Loops, collections, option types)

use std::collections::{HashMap, VecDeque, HashSet};
use serde::{Serialize, Deserialize};


/// An edge points to a `target` format and specifies the `converter` engine.
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Edge {
    pub target: String,
    pub converter: String, // "ffmpeg", "imagemagick", "pandoc", "libreoffice", "python", "xpdf"
}


pub struct ConversionGraph {
    // A map from source format (e.g., "docx") to list of possible target edges (e.g., [{"target": "pdf", "converter": "libreoffice"}])
    pub adjacency_list: HashMap<String, Vec<Edge>>,
}

impl ConversionGraph {

    pub fn new() -> Self {
        let mut graph = ConversionGraph {
            adjacency_list: HashMap::new(),
        };
        graph.build_graph();
        graph
    }

    fn add_edge(&mut self, source: &str, target: &str, converter: &str) {
        let edge = Edge {
            target: target.to_lowercase(),
            converter: converter.to_string(),
        };
        self.adjacency_list
            .entry(source.to_lowercase())
            .or_insert_with(Vec::new)
            .push(edge);
    }

    fn build_graph(&mut self) {
        // Video formats (FFmpeg)
        let video_formats = vec!["mp4", "mkv", "avi", "mov", "webm", "wmv", "flv", "gif"];
        for src in &video_formats {
            for dst in &video_formats {
                if src != dst {
                    self.add_edge(src, dst, "ffmpeg");
                }
            }
        }

        // Video to Audio (extract)
        let audio_formats = vec!["mp3", "wav", "aac", "flac", "ogg", "m4a"];
        for video in &video_formats {
            for audio in &audio_formats {
                self.add_edge(video, audio, "ffmpeg");
            }
        }

        // Audio to Audio
        for src in &audio_formats {
            for dst in &audio_formats {
                if src != dst {
                    self.add_edge(src, dst, "ffmpeg");
                }
            }
        }

        // Image formats (ImageMagick)
        let image_formats = vec!["jpg", "jpeg", "png", "webp", "gif", "bmp", "tiff", "ico", "svg"];
        for src in &image_formats {
            for dst in &image_formats {
                if src != dst {
                    self.add_edge(src, dst, "imagemagick");
                }
            }
        }

        // Document formats (Pandoc & LibreOffice)
        let doc_formats = vec!["docx", "doc", "odt", "rtf", "txt", "html", "md"];
        for src in &doc_formats {
            for dst in &doc_formats {
                if src != dst {
                    self.add_edge(src, dst, "pandoc");
                }
            }
            // To PDF via LibreOffice
            self.add_edge(src, "pdf", "libreoffice");
        }

        // PDF to images (ImageMagick)
        self.add_edge("pdf", "png", "imagemagick");
        self.add_edge("pdf", "jpg", "imagemagick");

        // PDF to DOCX (Python - pdf2docx)
        self.add_edge("pdf", "docx", "python");

        // PDF to Text (XPDF - pdftotext)
        self.add_edge("pdf", "txt", "xpdf");

        // eBook formats (Pandoc)
        self.add_edge("epub", "pdf", "pandoc");
        self.add_edge("epub", "html", "pandoc");
        self.add_edge("md", "pdf", "pandoc");
        self.add_edge("md", "html", "pandoc");
        self.add_edge("md", "docx", "pandoc");
    }

    pub fn find_path(&self, source: &str, target: &str) -> Option<Vec<Edge>> {
        let src_lower = source.to_lowercase();
        let tgt_lower = target.to_lowercase();

        if src_lower == tgt_lower {
            return Some(Vec::new());
        }

        if !self.adjacency_list.contains_key(&src_lower) {
            return None;
        }

        let mut visited = HashSet::new();
        let mut queue = VecDeque::new();
        queue.push_back((src_lower.clone(), Vec::new()));

        while let Some((node, path)) = queue.pop_front() {
            if visited.contains(&node) {
                continue;
            }
            visited.insert(node.clone());

            if let Some(edges) = self.adjacency_list.get(&node) {
                for edge in edges {
                    let mut new_path = path.clone();
                    new_path.push(edge.clone());

                    if edge.target == tgt_lower {
                        return Some(new_path);
                    }

                    if !visited.contains(&edge.target) {
                        queue.push_back((edge.target.clone(), new_path));
                    }
                }
            }
        }

        None
    }

    pub fn get_targets(&self, source: &str) -> Vec<String> {
        let src_lower = source.to_lowercase();
        let mut reachable = HashSet::new();
        let mut visited = HashSet::new();
        let mut queue = VecDeque::new();
        queue.push_back(src_lower);

        while let Some(node) = queue.pop_front() {
            if visited.contains(&node) {
                continue;
            }
            visited.insert(node.clone());

            if let Some(edges) = self.adjacency_list.get(&node) {
                for edge in edges {
                    reachable.insert(edge.target.clone());
                    if !visited.contains(&edge.target) {
                        queue.push_back(edge.target.clone());
                    }
                }
            }
        }

        let mut result: Vec<String> = reachable.into_iter().collect();
        result.sort();
        result
    }
}
