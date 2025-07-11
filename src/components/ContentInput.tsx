// UPDATE-1: Added multiple file upload functionality and upload status visibility
// Pause Button Added In Audio/Video + Camera Switch Function + Multiple File Upload + Upload Status

import React, { useState, useEffect, useRef } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, MapPin, Type, Mic, Video, Image, X, Check, AlertCircle, Camera, Square, Play, Pause, RotateCcw, RefreshCw, Upload, Trash2, FileText, Eye } from 'lucide-react';
import { toast } from "sonner";

interface Category {
  id: string;
  name: string;
  title: string;
  description: string;
  published: boolean;
  rank: number;
  created_at: string;
  updated_at: string;
}

// UPDATE-2: Added interface for upload progress tracking
interface UploadProgress {
  fileName: string;
  progress: number;
  status: 'uploading' | 'success' | 'error' | 'pending';
  error?: string;
}

interface ContentInputProps {
  uploadMode: 'text' | 'audio' | 'video' | 'image' | null;
  selectedCategory: Category;
  title: string;
  setTitle: (title: string) => void;
  textContent: string;
  setTextContent: (content: string) => void;
  // UPDATE-3: Modified to handle multiple files
  selectedFile: File | null;
  setSelectedFile: (file: File | null) => void;
  selectedFiles?: File[];
  setSelectedFiles?: (files: File[]) => void;
  location: { lat: number, lng: number } | null;
  setLocation: (location: { lat: number, lng: number } | null) => void;
  locationError: string;
  setLocationError: (error: string) => void;
  showManualLocation: boolean;
  setShowManualLocation: (show: boolean) => void;
  manualLat: string;
  setManualLat: (lat: string) => void;
  manualLng: string;
  setManualLng: (lng: string) => void;
  uploading: boolean;
  token: string;
  userId: string;
  onBack: () => void;
  onUpload: () => void;
  requestLocation: () => void;
  handleManualLocationSubmit: () => void;
  handleFileSelect: (event: React.ChangeEvent<HTMLInputElement>) => void;
  // UPDATE-4: Added upload progress props
  uploadProgress?: UploadProgress[];
  setUploadProgress?: (progress: UploadProgress[]) => void;
}

const ContentInput: React.FC<ContentInputProps> = ({
  uploadMode,
  selectedCategory,
  title,
  setTitle,
  textContent,
  setTextContent,
  selectedFile,
  setSelectedFile,
  selectedFiles = [],
  setSelectedFiles,
  location,
  setLocation,
  locationError,
  setLocationError,
  showManualLocation,
  setShowManualLocation,
  manualLat,
  setManualLat,
  manualLng,
  setManualLng,
  uploading,
  token,
  userId,
  onBack,
  onUpload,
  requestLocation,
  handleManualLocationSubmit,
  handleFileSelect,
  uploadProgress = [],
  setUploadProgress
}) => {
  // Recording states
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [recordingTime, setRecordingTime] = useState(0);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [recordedChunks, setRecordedChunks] = useState<BlobPart[]>([]);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  
  // UPDATE-5: Added state for multiple file management
  const [dragOver, setDragOver] = useState(false);
  const [filePreview, setFilePreview] = useState<{[key: string]: string}>({});

  const videoRef = useRef<HTMLVideoElement>(null);
  const videoCaptureRef = useRef<HTMLVideoElement>(null);
  const videoRecordingRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const recordingInterval = useRef<NodeJS.Timeout | null>(null);
  // UPDATE-6: Added file input ref for multiple files
  const fileInputRef = useRef<HTMLInputElement>(null);

  const uploadOptions = [
    {
      type: 'text' as const,
      icon: <Type className="w-6 h-6" />,
      title: 'Text Input',
      description: 'Type your content',
      accept: ''
    },
    {
      type: 'audio' as const,
      icon: <Mic className="w-6 h-6" />,
      title: 'Audio Recording',
      description: 'Record your voice',
      accept: 'audio/*'
    },
    {
      type: 'video' as const,
      icon: <Video className="w-6 h-6" />,
      title: 'Video Content',
      description: 'Record or upload video',
      accept: 'video/*'
    },
    {
      type: 'image' as const,
      icon: <Image className="w-6 h-6" />,
      title: 'Photo Capture',
      description: 'Take or upload photos',
      accept: 'image/*'
    }
  ];

  useEffect(() => {
    if (isRecording && !isPaused) {
      recordingInterval.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } else {
      if (recordingInterval.current) {
        clearInterval(recordingInterval.current);
      }
    }
    return () => {
      if (recordingInterval.current) {
        clearInterval(recordingInterval.current);
      }
    };
  }, [isRecording, isPaused]);

  // UPDATE-7: Added effect to generate file previews
  useEffect(() => {
    const newPreviews: {[key: string]: string} = {};
    
    selectedFiles.forEach(file => {
      if (file.type.startsWith('image/')) {
        newPreviews[file.name] = URL.createObjectURL(file);
      }
    });
    
    setFilePreview(newPreviews);
    
    // Cleanup old URLs
    return () => {
      Object.values(newPreviews).forEach(url => {
        URL.revokeObjectURL(url);
      });
    };
  }, [selectedFiles]);

  // UPDATE-8: Added drag and drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    
    const files = Array.from(e.dataTransfer.files);
    handleMultipleFileSelect(files);
  };

  // UPDATE-9: Added function to handle multiple file selection
  const handleMultipleFileSelect = (newFiles: File[]) => {
    const currentUploadMode = uploadMode;
    
    // Filter files based on upload mode
    const validFiles = newFiles.filter(file => {
      switch (currentUploadMode) {
        case 'audio':
          return file.type.startsWith('audio/');
        case 'video':
          return file.type.startsWith('video/');
        case 'image':
          return file.type.startsWith('image/');
        default:
          return true;
      }
    });

    if (validFiles.length !== newFiles.length) {
      toast.error(`Some files were filtered out. Only ${currentUploadMode} files are allowed.`);
    }

    if (validFiles.length === 0) {
      toast.error('No valid files selected');
      return;
    }

    if (setSelectedFiles) {
      const updatedFiles = [...selectedFiles, ...validFiles];
      setSelectedFiles(updatedFiles);
      
      // Initialize upload progress for new files
      if (setUploadProgress) {
        const newProgress: UploadProgress[] = validFiles.map(file => ({
          fileName: file.name,
          progress: 0,
          status: 'pending'
        }));
        setUploadProgress([...uploadProgress, ...newProgress]);
      }
    }

    // If single file mode, set the first file
    if (validFiles.length > 0) {
      setSelectedFile(validFiles[0]);
    }

    toast.success(`${validFiles.length} file(s) selected`);
  };

  // UPDATE-10: Added function to remove individual files
  const removeFile = (fileName: string) => {
    if (setSelectedFiles) {
      const updatedFiles = selectedFiles.filter(file => file.name !== fileName);
      setSelectedFiles(updatedFiles);
      
      if (setUploadProgress) {
        const updatedProgress = uploadProgress.filter(p => p.fileName !== fileName);
        setUploadProgress(updatedProgress);
      }
    }
    
    // If removing the currently selected file, clear it
    if (selectedFile && selectedFile.name === fileName) {
      setSelectedFile(null);
    }
    
    toast.success('File removed');
  };

  // UPDATE-11: Added function to format file size
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // UPDATE-12: Added function to get file type icon
  const getFileTypeIcon = (file: File) => {
    if (file.type.startsWith('image/')) return <Image className="w-4 h-4" />;
    if (file.type.startsWith('video/')) return <Video className="w-4 h-4" />;
    if (file.type.startsWith('audio/')) return <Mic className="w-4 h-4" />;
    return <FileText className="w-4 h-4" />;
  };

  const switchCamera = async () => {
    const newFacingMode = facingMode === 'user' ? 'environment' : 'user';
    setFacingMode(newFacingMode);
    
    // Stop current stream
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
    }
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
    }

    try {
      // Start new stream with switched camera
      if (uploadMode === 'image' && isCameraActive) {
        await capturePhoto(newFacingMode);
      } else if (uploadMode === 'video' && isRecording) {
        // For video recording, we need to restart the recording with new camera
        const wasRecording = isRecording;
        const wasPaused = isPaused;
        const currentTime = recordingTime;
        
        // Stop current recording
        if (mediaRecorder) {
          mediaRecorder.stop();
        }
        
        // Start new recording with new camera
        setTimeout(() => {
          startRecording('video', newFacingMode);
          if (wasPaused) {
            setTimeout(() => {
              setRecordingTime(currentTime);
              pauseRecording();
            }, 100);
          }
        }, 100);
      }
      
      toast.success(`Switched to ${newFacingMode === 'user' ? 'front' : 'rear'} camera`);
    } catch (error) {
      console.error('Camera switch error:', error);
      toast.error('Failed to switch camera');
      // Revert facing mode if switch failed
      setFacingMode(facingMode);
    }
  };

  const startRecording = async (type: 'audio' | 'video', customFacingMode?: 'user' | 'environment') => {
    try {
      const currentFacingMode = customFacingMode || facingMode;
      const constraints = type === 'audio'
        ? { audio: true }
        : {
          audio: true,
          video: {
            facingMode: currentFacingMode,
            width: { ideal: 1280 },
            height: { ideal: 720 }
          }
        };

      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      setStream(mediaStream);

      if (type === 'video' && videoRecordingRef.current) {
        const video = videoRecordingRef.current;
        video.srcObject = mediaStream;
        video.autoplay = true;
        video.muted = true;
        video.playsInline = true;

        video.onloadedmetadata = () => {
          video.play().catch(error => {
            console.error('Video play error:', error);
            toast.error('Failed to start video preview');
          });
        };
      }

      const recorder = new MediaRecorder(mediaStream);
      const chunks: BlobPart[] = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data);
          setRecordedChunks(prev => [...prev, event.data]);
        }
      };

      recorder.onstop = () => {
        const blob = new Blob(chunks, {
          type: type === 'audio' ? 'audio/webm' : 'video/webm'
        });
        setRecordedBlob(blob);
        const recordedFile = new File([blob], `recorded-${type}.webm`, {
          type: blob.type
        });
        setSelectedFile(recordedFile);
        
        // UPDATE-13: Add recorded file to multiple files array
        if (setSelectedFiles) {
          setSelectedFiles([...selectedFiles, recordedFile]);
        }
        
        const url = URL.createObjectURL(blob);
        if (type === 'audio') {
          setAudioUrl(url);
        } else {
          setVideoUrl(url);
        }
      };

      recorder.start();
      setMediaRecorder(recorder);
      setIsRecording(true);
      setIsPaused(false);
      setRecordingTime(0);
      setRecordedChunks([]);
      toast.success(`${type === 'audio' ? 'Audio' : 'Video'} recording started`);
    } catch (error) {
      console.error('Recording error:', error);
      toast.error(`Failed to start ${type} recording. Please check permissions.`);
    }
  };

  const pauseRecording = () => {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
      mediaRecorder.pause();
      setIsPaused(true);
      toast.success('Recording paused');
    }
  };

  const resumeRecording = () => {
    if (mediaRecorder && mediaRecorder.state === 'paused') {
      mediaRecorder.resume();
      setIsPaused(false);
      toast.success('Recording resumed');
    }
  };

  const stopRecording = () => {
    if (mediaRecorder && (mediaRecorder.state === 'recording' || mediaRecorder.state === 'paused')) {
      mediaRecorder.stop();
    }

    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }

    setIsRecording(false);
    setIsPaused(false);
    setMediaRecorder(null);
    toast.success('Recording stopped');
  };

  const capturePhoto = async (customFacingMode?: 'user' | 'environment') => {
    try {
      const currentFacingMode = customFacingMode || facingMode;
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: currentFacingMode,
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      });

      setCameraStream(mediaStream);
      setIsCameraActive(true);

      if (videoRef.current && canvasRef.current) {
        const video = videoRef.current as HTMLVideoElement;
        const canvas = canvasRef.current as HTMLCanvasElement;

        video.srcObject = mediaStream;
        video.autoplay = true;
        video.muted = true;
        video.playsInline = true;

        await new Promise((resolve, reject) => {
          video.onloadedmetadata = () => {
            video.play().then(() => {
              setTimeout(() => {
                try {
                  canvas.width = video.videoWidth || 640;
                  canvas.height = video.videoHeight || 480;
                  const ctx = canvas.getContext('2d');

                  if (ctx && video.videoWidth > 0 && video.videoHeight > 0) {
                    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

                    canvas.toBlob((blob) => {
                      if (blob) {
                        const capturedFile = new File([blob], 'captured-photo.jpg', { type: 'image/jpeg' });
                        setSelectedFile(capturedFile);
                        
                        // UPDATE-14: Add captured photo to multiple files array
                        if (setSelectedFiles) {
                          setSelectedFiles([...selectedFiles, capturedFile]);
                        }
                        
                        toast.success('Photo captured! Click "Stop Camera" when done.');
                        resolve(blob);
                      } else {
                        reject(new Error('Failed to create blob'));
                      }
                    }, 'image/jpeg', 0.9);
                  } else {
                    reject(new Error('Video not ready'));
                  }
                } catch (error) {
                  reject(error);
                }
              }, 1000);
            }).catch(reject);
          };
          video.onerror = reject;
        });
      }
    } catch (error) {
      console.error('Photo capture error:', error);
      toast.error('Failed to capture photo. Please check camera permissions.');
    }
  };

  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      setCameraStream(null);
      setIsCameraActive(false);
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const resetRecording = () => {
    setRecordedBlob(null);
    setSelectedFile(null);
    setRecordingTime(0);
    setRecordedChunks([]);
    setAudioUrl(null);
    setVideoUrl(null);
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    if (videoUrl) URL.revokeObjectURL(videoUrl);
  };

  // UPDATE-15: Modified to handle multiple files
  const handleFileSelectInternal = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length > 0) {
      handleMultipleFileSelect(files);
    }
    handleFileSelect(event);
  };

  // UPDATE-16: Added function to render upload progress
  const renderUploadProgress = () => {
    if (uploadProgress.length === 0) return null;

    return (
      <Card className="mb-6 border-blue-200 bg-blue-50">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg text-blue-800 flex items-center gap-2">
            <Upload className="w-5 h-5" />
            Upload Progress
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {uploadProgress.map((progress, index) => (
            <div key={index} className="bg-white p-3 rounded-lg border">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700 truncate">
                  {progress.fileName}
                </span>
                <span className="text-sm text-gray-500">
                  {progress.status === 'uploading' && `${progress.progress}%`}
                  {progress.status === 'success' && 'Complete'}
                  {progress.status === 'error' && 'Failed'}
                  {progress.status === 'pending' && 'Pending'}
                </span>
              </div>
              
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className={`h-2 rounded-full transition-all duration-300 ${
                    progress.status === 'success' ? 'bg-green-500' :
                    progress.status === 'error' ? 'bg-red-500' :
                    progress.status === 'uploading' ? 'bg-blue-500' :
                    'bg-gray-300'
                  }`}
                  style={{ 
                    width: progress.status === 'success' ? '100%' : 
                           progress.status === 'error' ? '100%' : 
                           `${progress.progress}%` 
                  }}
                />
              </div>
              
              {progress.status === 'error' && progress.error && (
                <p className="text-red-600 text-xs mt-1">{progress.error}</p>
              )}
            </div>
          ))}
        </CardContent>
      </Card>
    );
  };

  // UPDATE-17: Added function to render selected files
  const renderSelectedFiles = () => {
    if (selectedFiles.length === 0) return null;

    return (
      <Card className="mb-6 border-green-200 bg-green-50">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg text-green-800 flex items-center gap-2">
            <Check className="w-5 h-5" />
            Selected Files ({selectedFiles.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {selectedFiles.map((file, index) => (
            <div key={index} className="bg-white p-3 rounded-lg border flex items-center gap-3">
              <div className="text-blue-600">
                {getFileTypeIcon(file)}
              </div>
              
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-700 truncate">
                  {file.name}
                </p>
                <p className="text-xs text-gray-500">
                  {formatFileSize(file.size)}
                </p>
              </div>
              
              {filePreview[file.name] && (
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const img = new window.Image();
                      img.src = filePreview[file.name];
                      const newWindow = window.open();
                      newWindow?.document.write(`<img src="${filePreview[file.name]}" style="max-width: 100%; height: auto;" />`);
                    }}
                  >
                    <Eye className="w-4 h-4" />
                  </Button>
                </div>
              )}
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => removeFile(file.name)}
                className="text-red-600 hover:text-red-700 hover:bg-red-50"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Full-width Purple Header Bar */}
      <div className="bg-gradient-to-r from-purple-500 via-purple-600 to-purple-700 text-white px-6 py-6 shadow-lg relative">
        {/* Back Button - Positioned at absolute left */}
        <Button
          onClick={onBack}
          variant="ghost"
          size="sm"
          className="absolute left-2 md:left-4 top-1/2 transform -translate-y-1/2 text-white hover:bg-white/20 rounded-lg z-10
                     w-10 h-10 p-0 md:w-auto md:h-auto md:p-2"
        >
          <ArrowLeft className="w-4 h-4 md:mr-2" />
          <span className="hidden md:inline">Back</span>
        </Button>
        
        {/* Center Content */}
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-2xl font-bold">
            {uploadOptions.find(opt => opt.type === uploadMode)?.title}
          </h1>
          <p className="text-purple-100 text-sm mt-1">
            {selectedCategory.title}
          </p>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="max-w-4xl mx-auto px-6 py-8">
        <Card className="bg-white shadow-lg border-0 rounded-xl overflow-hidden">
          <CardContent className="p-8">
            {/* Upload Form Header */}
            <div className="flex items-center mb-8">
              <div className="bg-purple-100 p-3 rounded-lg mr-4">
                {uploadOptions.find(opt => opt.type === uploadMode)?.icon}
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Upload Content</h2>
                <p className="text-gray-600">Choose how you'd like to contribute</p>
              </div>
            </div>

            {/* Title Input */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Title *
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                placeholder="Enter a title for your content"
              />
            </div>

            {/* Location Status */}
            <div className="bg-gray-50 p-4 rounded-lg mb-6">
              <div className="flex items-center gap-2 mb-2">
                <MapPin className="w-4 h-4 text-gray-600" />
                <span className="text-sm font-medium text-gray-700">Location</span>
              </div>
              {location ? (
                <div className="flex items-center gap-2 text-green-600">
                  <Check className="w-4 h-4" />
                  <span className="text-sm">
                    Location: {location.lat.toFixed(4)}, {location.lng.toFixed(4)}
                  </span>
                </div>
              ) : locationError ? (
                <div className="flex items-center gap-2 text-red-600">
                  <AlertCircle className="w-4 h-4" />
                  <span className="text-sm">{locationError}</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-orange-600">
                  <AlertCircle className="w-4 h-4" />
                  <span className="text-sm">Location required</span>
                </div>
              )}

              {!location && (
                <div className="flex gap-2 mt-3">
                  <Button
                    onClick={requestLocation}
                    size="sm"
                    className="bg-purple-600 hover:bg-purple-700"
                  >
                    <MapPin className="w-4 h-4 mr-1" />
                    Get Location
                  </Button>
                  <Button
                    onClick={() => setShowManualLocation(!showManualLocation)}
                    variant="outline"
                    size="sm"
                  >
                    Manual
                  </Button>
                </div>
              )}
            </div>

            {/* Manual Location Input */}
            {showManualLocation && (
              <Card className="border-orange-200 bg-orange-50 mb-6">
                <CardContent className="p-4">
                  <h3 className="font-medium text-gray-800 mb-3">Enter Location Manually</h3>
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Latitude
                      </label>
                      <input
                        type="number"
                        step="any"
                        value={manualLat}
                        onChange={(e) => setManualLat(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
                        placeholder="e.g., 17.3850"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Longitude
                      </label>
                      <input
                        type="number"
                        step="any"
                        value={manualLng}
                        onChange={(e) => setManualLng(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-purple-500 focus:border
                        -transparent text-sm"
                        placeholder="e.g., 78.4867"
                      />
                    </div>
                  </div>
                  <Button
                    onClick={handleManualLocationSubmit}
                    size="sm"
                    className="bg-purple-600 hover:bg-purple-700"
                  >
                    Set Location
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Upload Progress */}
            {renderUploadProgress()}

            {/* Selected Files */}
            {renderSelectedFiles()}

            {/* Content Input based on upload mode */}
            {uploadMode === 'text' && (
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Content *
                </label>
                <textarea
                  value={textContent}
                  onChange={(e) => setTextContent(e.target.value)}
                  rows={8}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="Enter your content here..."
                />
              </div>
            )}

            {uploadMode === 'audio' && (
              <div className="mb-6">
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                  {!isRecording && !recordedBlob && (
                    <div className="space-y-4">
                      <div className="flex justify-center">
                        <div className="bg-purple-100 p-4 rounded-full">
                          <Mic className="w-8 h-8 text-purple-600" />
                        </div>
                      </div>
                      <div>
                        <h3 className="text-lg font-medium text-gray-900 mb-2">
                          Record Audio
                        </h3>
                        <p className="text-gray-600 mb-4">
                          Click to start recording your audio content
                        </p>
                        <div className="flex gap-3 justify-center">
                          <Button
                            onClick={() => startRecording('audio')}
                            className="bg-red-600 hover:bg-red-700"
                          >
                            <Mic className="w-4 h-4 mr-2" />
                            Start Recording
                          </Button>
                          <Button
                            onClick={() => fileInputRef.current?.click()}
                            variant="outline"
                          >
                            <Upload className="w-4 h-4 mr-2" />
                            Upload Audio
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}

                  {isRecording && (
                    <div className="space-y-4">
                      <div className="flex justify-center">
                        <div className={`p-4 rounded-full ${isPaused ? 'bg-yellow-100' : 'bg-red-100'}`}>
                          <Mic className={`w-8 h-8 ${isPaused ? 'text-yellow-600' : 'text-red-600'}`} />
                        </div>
                      </div>
                      <div>
                        <h3 className="text-lg font-medium text-gray-900 mb-2">
                          {isPaused ? 'Recording Paused' : 'Recording...'}
                        </h3>
                        <p className="text-2xl font-bold text-gray-900 mb-4">
                          {formatTime(recordingTime)}
                        </p>
                        <div className="flex gap-3 justify-center">
                          {!isPaused ? (
                            <Button
                              onClick={pauseRecording}
                              className="bg-yellow-600 hover:bg-yellow-700"
                            >
                              <Pause className="w-4 h-4 mr-2" />
                              Pause
                            </Button>
                          ) : (
                            <Button
                              onClick={resumeRecording}
                              className="bg-green-600 hover:bg-green-700"
                            >
                              <Play className="w-4 h-4 mr-2" />
                              Resume
                            </Button>
                          )}
                          <Button
                            onClick={stopRecording}
                            className="bg-red-600 hover:bg-red-700"
                          >
                            <Square className="w-4 h-4 mr-2" />
                            Stop
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}

                  {recordedBlob && audioUrl && (
                    <div className="space-y-4">
                      <div className="flex justify-center">
                        <div className="bg-green-100 p-4 rounded-full">
                          <Check className="w-8 h-8 text-green-600" />
                        </div>
                      </div>
                      <div>
                        <h3 className="text-lg font-medium text-gray-900 mb-2">
                          Recording Complete
                        </h3>
                        <p className="text-gray-600 mb-4">
                          Duration: {formatTime(recordingTime)}
                        </p>
                        <audio controls className="w-full mb-4">
                          <source src={audioUrl} type="audio/webm" />
                          Your browser does not support the audio element.
                        </audio>
                        <div className="flex gap-3 justify-center">
                          <Button
                            onClick={resetRecording}
                            variant="outline"
                          >
                            <RotateCcw className="w-4 h-4 mr-2" />
                            Record Again
                          </Button>
                          <Button
                            onClick={() => fileInputRef.current?.click()}
                            variant="outline"
                          >
                            <Upload className="w-4 h-4 mr-2" />
                            Upload Different Audio
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {uploadMode === 'video' && (
              <div className="mb-6">
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                  {!isRecording && !recordedBlob && (
                    <div className="space-y-4">
                      <div className="flex justify-center">
                        <div className="bg-purple-100 p-4 rounded-full">
                          <Video className="w-8 h-8 text-purple-600" />
                        </div>
                      </div>
                      <div>
                        <h3 className="text-lg font-medium text-gray-900 mb-2">
                          Record Video
                        </h3>
                        <p className="text-gray-600 mb-4">
                          Click to start recording your video content
                        </p>
                        <div className="flex gap-3 justify-center">
                          <Button
                            onClick={() => startRecording('video')}
                            className="bg-red-600 hover:bg-red-700"
                          >
                            <Video className="w-4 h-4 mr-2" />
                            Start Recording
                          </Button>
                          <Button
                            onClick={() => fileInputRef.current?.click()}
                            variant="outline"
                          >
                            <Upload className="w-4 h-4 mr-2" />
                            Upload Video
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}

                  {isRecording && (
                    <div className="space-y-4">
                      <div className="relative">
                        <video
                          ref={videoRecordingRef}
                          className="w-full max-w-md mx-auto rounded-lg"
                          style={{ transform: facingMode === 'user' ? 'scaleX(-1)' : 'scaleX(1)' }}
                        />
                        <div className="absolute top-2 right-2 flex gap-2">
                          <Button
                            onClick={switchCamera}
                            size="sm"
                            variant="outline"
                            className="bg-white/90 hover:bg-white"
                          >
                            <RefreshCw className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                      <div>
                        <h3 className="text-lg font-medium text-gray-900 mb-2">
                          {isPaused ? 'Recording Paused' : 'Recording...'}
                        </h3>
                        <p className="text-2xl font-bold text-gray-900 mb-4">
                          {formatTime(recordingTime)}
                        </p>
                        <div className="flex gap-3 justify-center">
                          {!isPaused ? (
                            <Button
                              onClick={pauseRecording}
                              className="bg-yellow-600 hover:bg-yellow-700"
                            >
                              <Pause className="w-4 h-4 mr-2" />
                              Pause
                            </Button>
                          ) : (
                            <Button
                              onClick={resumeRecording}
                              className="bg-green-600 hover:bg-green-700"
                            >
                              <Play className="w-4 h-4 mr-2" />
                              Resume
                            </Button>
                          )}
                          <Button
                            onClick={stopRecording}
                            className="bg-red-600 hover:bg-red-700"
                          >
                            <Square className="w-4 h-4 mr-2" />
                            Stop
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}

                  {recordedBlob && videoUrl && (
                    <div className="space-y-4">
                      <div className="flex justify-center">
                        <div className="bg-green-100 p-4 rounded-full">
                          <Check className="w-8 h-8 text-green-600" />
                        </div>
                      </div>
                      <div>
                        <h3 className="text-lg font-medium text-gray-900 mb-2">
                          Recording Complete
                        </h3>
                        <p className="text-gray-600 mb-4">
                          Duration: {formatTime(recordingTime)}
                        </p>
                        <video controls className="w-full max-w-md mx-auto rounded-lg mb-4">
                          <source src={videoUrl} type="video/webm" />
                          Your browser does not support the video element.
                        </video>
                        <div className="flex gap-3 justify-center">
                          <Button
                            onClick={resetRecording}
                            variant="outline"
                          >
                            <RotateCcw className="w-4 h-4 mr-2" />
                            Record Again
                          </Button>
                          <Button
                            onClick={() => fileInputRef.current?.click()}
                            variant="outline"
                          >
                            <Upload className="w-4 h-4 mr-2" />
                            Upload Different Video
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {uploadMode === 'image' && (
              <div className="mb-6">
                <div 
                  className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors
                    ${dragOver ? 'border-purple-500 bg-purple-50' : 'border-gray-300'}`}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                >
                  {!isCameraActive && !selectedFile && (
                    <div className="space-y-4">
                      <div className="flex justify-center">
                        <div className="bg-purple-100 p-4 rounded-full">
                          <Camera className="w-8 h-8 text-purple-600" />
                        </div>
                      </div>
                      <div>
                        <h3 className="text-lg font-medium text-gray-900 mb-2">
                          Capture Photo
                        </h3>
                        <p className="text-gray-600 mb-4">
                          Take a photo or upload image files
                        </p>
                        <div className="flex gap-3 justify-center">
                          <Button
                            onClick={() => capturePhoto()}
                            className="bg-purple-600 hover:bg-purple-700"
                          >
                            <Camera className="w-4 h-4 mr-2" />
                            Open Camera
                          </Button>
                          <Button
                            onClick={() => fileInputRef.current?.click()}
                            variant="outline"
                          >
                            <Upload className="w-4 h-4 mr-2" />
                            Upload Images
                          </Button>
                        </div>
                        <p className="text-sm text-gray-500 mt-2">
                          Or drag and drop image files here
                        </p>
                      </div>
                    </div>
                  )}

                  {isCameraActive && (
                    <div className="space-y-4">
                      <div className="relative">
                        <video
                          ref={videoRef}
                          className="w-full max-w-md mx-auto rounded-lg"
                          style={{ transform: facingMode === 'user' ? 'scaleX(-1)' : 'scaleX(1)' }}
                        />
                        <canvas ref={canvasRef} className="hidden" />
                        <div className="absolute top-2 right-2 flex gap-2">
                          <Button
                            onClick={switchCamera}
                            size="sm"
                            variant="outline"
                            className="bg-white/90 hover:bg-white"
                          >
                            <RefreshCw className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                      <div>
                        <h3 className="text-lg font-medium text-gray-900 mb-2">
                          Camera Active
                        </h3>
                        <p className="text-gray-600 mb-4">
                          Position your shot and click capture
                        </p>
                        <div className="flex gap-3 justify-center">
                          <Button
                            onClick={() => capturePhoto()}
                            className="bg-purple-600 hover:bg-purple-700"
                          >
                            <Camera className="w-4 h-4 mr-2" />
                            Capture Photo
                          </Button>
                          <Button
                            onClick={stopCamera}
                            variant="outline"
                            className="text-red-600 hover:text-red-700"
                          >
                            <X className="w-4 h-4 mr-2" />
                            Stop Camera
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Hidden file input for multiple file uploads */}
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept={uploadOptions.find(opt => opt.type === uploadMode)?.accept}
              onChange={handleFileSelectInternal}
              className="hidden"
            />

            {/* Action Buttons */}
            <div className="flex gap-4 pt-6 border-t">
              <Button
                onClick={onBack}
                variant="outline"
                className="flex-1"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
              <Button
                onClick={onUpload}
                disabled={
                  uploading ||
                  !title.trim() ||
                  !location ||
                  (uploadMode === 'text' && !textContent.trim()) ||
                  (uploadMode !== 'text' && selectedFiles.length === 0)
                }
                className="flex-1 bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800"
              >
                {uploading ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4 mr-2" />
                    Upload Content
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ContentInput;