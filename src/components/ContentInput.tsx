// Fixed Audio Recording with Network Error Resolution

import React, { useState, useEffect, useRef } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, MapPin, Type, Mic, Video, Image, X, Check, AlertCircle, Camera, Square, Play, Pause, RotateCcw, RefreshCw } from 'lucide-react';
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

interface ContentInputProps {
  uploadMode: 'text' | 'audio' | 'video' | 'image' | null;
  selectedCategory: Category;
  title: string;
  setTitle: (title: string) => void;
  textContent: string;
  setTextContent: (content: string) => void;
  selectedFile: File | null;
  setSelectedFile: (file: File | null) => void;
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
  handleFileSelect
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

  const videoRef = useRef<HTMLVideoElement>(null);
  const videoCaptureRef = useRef<HTMLVideoElement>(null);
  const videoRecordingRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const recordingInterval = useRef<NodeJS.Timeout | null>(null);

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
      
      // Enhanced constraints for better compatibility
      const constraints = type === 'audio'
        ? { 
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true,
              sampleRate: 44100,
              channelCount: 2
            }
          }
        : {
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true,
              sampleRate: 44100
            },
            video: {
              facingMode: currentFacingMode,
              width: { ideal: 1280, min: 640 },
              height: { ideal: 720, min: 480 },
              frameRate: { ideal: 30 }
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

      // Check MediaRecorder support and use best available format
      let mimeType = '';
      const possibleTypes = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/ogg;codecs=opus',
        'audio/ogg',
        'audio/wav',
        'audio/mp4'
      ];

      if (type === 'video') {
        possibleTypes.splice(0, 0, 
          'video/webm;codecs=vp9,opus',
          'video/webm;codecs=vp8,opus',
          'video/webm;codecs=h264,opus',
          'video/webm',
          'video/mp4;codecs=h264,aac',
          'video/mp4'
        );
      }

      for (const testType of possibleTypes) {
        if (MediaRecorder.isTypeSupported(testType)) {
          mimeType = testType;
          break;
        }
      }

      if (!mimeType) {
        // Fallback to default
        mimeType = type === 'audio' ? 'audio/webm' : 'video/webm';
      }

      // Create MediaRecorder with optimized settings
      const recorderOptions: MediaRecorderOptions = {
        mimeType: mimeType,
        bitsPerSecond: type === 'audio' ? 128000 : 2500000, // 128kbps for audio, 2.5Mbps for video
      };

      let recorder: MediaRecorder;
      try {
        recorder = new MediaRecorder(mediaStream, recorderOptions);
      } catch (error) {
        console.warn('Failed to create MediaRecorder with options, using defaults:', error);
        recorder = new MediaRecorder(mediaStream);
      }

      const chunks: BlobPart[] = [];
      setRecordedChunks([]);

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          chunks.push(event.data);
          setRecordedChunks(prev => [...prev, event.data]);
        }
      };

      recorder.onstop = () => {
        console.log('MediaRecorder stopped, creating blob with', chunks.length, 'chunks');
        
        if (chunks.length === 0) {
          console.error('No chunks recorded');
          toast.error('No audio/video data recorded. Please try again.');
          return;
        }

        // Create blob with detected mime type
        const blob = new Blob(chunks, { type: mimeType });
        console.log('Created blob:', blob.size, 'bytes, type:', blob.type);
        
        if (blob.size === 0) {
          console.error('Empty blob created');
          toast.error('Recording failed - empty file. Please try again.');
          return;
        }

        setRecordedBlob(blob);
        
        // Create file with proper extension
        const extension = type === 'audio' ? 
          (mimeType.includes('wav') ? 'wav' : mimeType.includes('ogg') ? 'ogg' : 'webm') :
          (mimeType.includes('mp4') ? 'mp4' : 'webm');
        
        const file = new File([blob], `recorded-${type}.${extension}`, {
          type: blob.type,
          lastModified: Date.now()
        });
        
        console.log('Created file:', file.name, file.size, 'bytes');
        setSelectedFile(file);
        
        // Create URL for preview
        const url = URL.createObjectURL(blob);
        if (type === 'audio') {
          setAudioUrl(url);
        } else {
          setVideoUrl(url);
        }
        
        toast.success(`${type === 'audio' ? 'Audio' : 'Video'} recording completed successfully!`);
      };

      recorder.onerror = (event) => {
        console.error('MediaRecorder error:', event);
        toast.error('Recording error occurred. Please try again.');
      };

      // Start recording with timeslice for better chunk management
      recorder.start(1000); // Request data every 1 second
      
      setMediaRecorder(recorder);
      setIsRecording(true);
      setIsPaused(false);
      setRecordingTime(0);
      
      console.log('Recording started with mime type:', mimeType);
      toast.success(`${type === 'audio' ? 'Audio' : 'Video'} recording started`);
      
    } catch (error) {
      console.error('Recording error:', error);
      let errorMessage = `Failed to start ${type} recording. `;
      
      if (error instanceof Error) {
        if (error.name === 'NotAllowedError') {
          errorMessage += 'Please allow microphone access and try again.';
        } else if (error.name === 'NotFoundError') {
          errorMessage += 'No microphone found. Please check your device.';
        } else if (error.name === 'NotSupportedError') {
          errorMessage += 'Recording not supported on this device.';
        } else {
          errorMessage += 'Please check your device permissions and try again.';
        }
      }
      
      toast.error(errorMessage);
      
      // Cleanup on error
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
        setStream(null);
      }
      setIsRecording(false);
      setIsPaused(false);
      setMediaRecorder(null);
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
    console.log('Stopping recording, current state:', mediaRecorder?.state);
    
    if (mediaRecorder && (mediaRecorder.state === 'recording' || mediaRecorder.state === 'paused')) {
      mediaRecorder.stop();
    }

    if (stream) {
      stream.getTracks().forEach(track => {
        track.stop();
        console.log('Stopped track:', track.kind);
      });
      setStream(null);
    }

    setIsRecording(false);
    setIsPaused(false);
    setMediaRecorder(null);
    
    // Don't show "Recording stopped" toast here as it will be shown in onstop handler
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
                        setSelectedFile(new File([blob], 'captured-photo.jpg', { type: 'image/jpeg' }));
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

  const handleFileSelectInternal = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      console.log('File selected:', file.name, file.size, 'bytes, type:', file.type);
      setSelectedFile(file);
      setRecordedBlob(null);
      setAudioUrl(null);
      setVideoUrl(null);
      toast.success('File selected successfully');
    }
    handleFileSelect(event);
  };

  // Cleanup URLs on unmount
  useEffect(() => {
    return () => {
      if (audioUrl) URL.revokeObjectURL(audioUrl);
      if (videoUrl) URL.revokeObjectURL(videoUrl);
    };
  }, [audioUrl, videoUrl]);

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
                        className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
                        placeholder="e.g., 78.4867"
                      />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={handleManualLocationSubmit}
                      size="sm"
                      className="bg-green-600 hover:bg-green-700"
                    >
                      <Check className="w-4 h-4 mr-1" />
                      Set Location
                    </Button>
                    <Button
                      onClick={() => setShowManualLocation(false)}
                      variant="outline"
                      size="sm"
                    >
                      <X className="w-4 h-4 mr-1" />
                      Cancel
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Content Input based on type */}
            {uploadMode === 'text' && (
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Content *
                </label>
                <textarea
                  value={textContent}
                  onChange={(e) => setTextContent(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent h-32 resize-vertical"
                  placeholder="Enter your text content here..."
                />
              </div>
            )}

            {uploadMode === 'audio' && (
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Audio Recording *
                </label>

                {!isRecording && !recordedBlob && (
                  <Button
                    onClick={() => startRecording('audio')}
                    className="w-full bg-red-500 hover:bg-red-600 text-white py-3 rounded-lg"
                  >
                    <Mic className="w-5 h-5 mr-2" />
                    Start Recording
                  </Button>
                )}

                {isRecording && (
                  <div className="text-center space-y-4">
                    <div className="text-2xl font-mono text-red-600">
                      {formatTime(recordingTime)}
                    </div>
                    <div className="flex justify-center gap-2">
                      {!isPaused ? (
                        <Button
                          onClick={pauseRecording}
                          className="bg-orange-500 hover:bg-orange-600 text-white"
                        >
                          <Pause className="w-5 h-5 mr-2" />
                          Pause
                        </Button>
                      ) : (
                        <Button
                          onClick={resumeRecording}
                          className="bg-green-500 hover:bg-green-600 text-white"
                        >
                          <Play className="w-5 h-5 mr-2" />
                          Resume
                        </Button>
                      )}
                      <Button
                        onClick={stopRecording}
                        className="bg-red-600 hover:bg-red-700 text-white"
                      >
                        <Square className="w-5 h-5 mr-2" />
                        Stop Recording
                      </Button>
                    </div>
                    {isPaused && (
                      <div className="text-sm text-orange-600 font-medium">
                        Recording paused
                      </div>
                    )}
                  </div>
                )}

                {recordedBlob && audioUrl && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg">
                      <span className="text-green-700 font-medium">
                        Recording completed ({formatTime(recordingTime)})
                      </span>
                      <Button
                        onClick={resetRecording}
                        variant="outline"
                        size="sm"
                      >
                        <RotateCcw className="w-4 h-4 mr-1" />
                        Record Again
                      </Button>
                    </div>
                    <audio controls className="w-full">
                      <source src={audioUrl} type="audio/webm" />
                      Your browser does not support the audio element.
                    </audio>
                  </div>
                )}

                <div className="mt-4">
                  <div className="text-center text-gray-500 mb-2">OR</div>
                  <label className="block">
                    <input
                      type="file"
                      accept="audio/*"
                      onChange={handleFileSelectInternal}
                      className="hidden"
                    />
                    <div className="w-full p-4 border-2 border-dashed border-gray-300 rounded-lg text-center cursor-pointer hover:border-purple-400 hover:bg-purple-50 transition-colors">
                      <Mic className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                      <span className="text-gray-600">
                        {selectedFile && !recordedBlob ? selectedFile.name : 'Upload Audio File'}
                      </span>
                    </div>
                  </label>
                </div>
              </div>
            )}

            {uploadMode === 'video' && (
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Video Recording *
                </label>

                {!isRecording && !recordedBlob && (
                  <div className="space-y-3">
                    <div className="flex gap-2">
                      <Button
                        onClick={() => startRecording('video')}
                        className="flex-1 bg-red-500 hover:bg-red-600 text-white py-3 rounded-lg"
                      >
                        <Video className="w-5 h-5 mr-2" />
                        Start Recording
                      </Button>
                      <Button
                        onClick={switchCamera}
                        variant="outline"
                        className="px-4 py-3"
                      >
                        <RefreshCw className="w-5 h-5" />
                      </Button>
                    </div>
                    <div className="text-xs text-gray-500 text-center">
                      Using {facingMode === 'user' ? 'Front' : 'Rear'} Camera
                    </div>
                  </div>
                )}

                {isRecording && (
                  <div className="text-center space-y-4">
                    <div className="relative">
                      <video
                        ref={videoRecordingRef}
                        className="w-full max-w-md mx-auto rounded-lg shadow-lg"
                        autoPlay
                        muted
                        playsInline
                      />
                      <div className="absolute top-4 left-4 bg-red-500 text-white px-2 py-1 rounded text-sm font-mono">
                        REC {formatTime(recordingTime)}
                      </div>
                    </div>
                    <div className="flex justify-center gap-2">
                      {!isPaused ? (
                        <Button
                          onClick={pauseRecording}
                          className="bg-orange-500 hover:bg-orange-600 text-white"
                        >
                          <Pause className="w-5 h-5 mr-2" />
                          Pause
                        </Button>
                      ) : (
                        <Button
                          onClick={resumeRecording}
                          className="bg-green-500 hover:bg-green-600 text-white"
                        >
                          <Play className="w-5 h-5 mr-2" />
                          Resume
                        </Button>
                      )}
                      <Button
                        onClick={stopRecording}
                        className="bg-red-600 hover:bg-red-700 text-white"
                      >
                        <Square className="w-5 h-5 mr-2" />
                        Stop Recording
                      </Button>
                      <Button
                        onClick={switchCamera}
                        variant="outline"
                        className="px-3"
                      >
                        <RefreshCw className="w-5 h-5" />
                      </Button>
                    </div>
                    {isPaused && (
                      <div className="text-sm text-orange-600 font-medium">
                        Recording paused
                      </div>
                    )}
                  </div>
                )}

                {recordedBlob && videoUrl && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg">
                      <span className="text-green-700 font-medium">
                        Recording completed ({formatTime(recordingTime)})
                      </span>
                      <Button
                        onClick={resetRecording}
                        variant="outline"
                        size="sm"
                      >
                        <RotateCcw className="w-4 h-4 mr-1" />
                        Record Again
                      </Button>
                    </div>
                    <video controls className="w-full max-w-md mx-auto rounded-lg shadow-lg">
                      <source src={videoUrl} type="video/webm" />
                      Your browser does not support the video element.
                    </video>
                  </div>
                )}

                <div className="mt-4">
                  <div className="text-center text-gray-500 mb-2">OR</div>
                  <label className="block">
                    <input
                      type="file"
                      accept="video/*"
                      onChange={handleFileSelectInternal}
                      className="hidden"
                    />
                    <div className="w-full p-4 border-2 border-dashed border-gray-300 rounded-lg text-center cursor-pointer hover:border-purple-400 hover:bg-purple-50 transition-colors">
                      <Video className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                      <span className="text-gray-600">
                        {selectedFile && !recordedBlob ? selectedFile.name : 'Upload Video File'}
                      </span>
                    </div>
                  </label>
                </div>
              </div>
            )}

            {uploadMode === 'image' && (
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Photo Capture *
                </label>

                {!isCameraActive && (
                  <div className="space-y-3">
                    <div className="flex gap-2">
                      <Button
                        onClick={() => capturePhoto()}
                        className="flex-1 bg-blue-500 hover:bg-blue-600 text-white py-3 rounded-lg"
                      >
                        <Camera className="w-5 h-5 mr-2" />
                        Take Photo
                      </Button>
                      <Button
                        onClick={switchCamera}
                        variant="outline"
                        className="px-4 py-3"
                      >
                        <RefreshCw className="w-5 h-5" />
                      </Button>
                    </div>
                    <div className="text-xs text-gray-500 text-center">
                      Using {facingMode === 'user' ? 'Front' : 'Rear'} Camera
                    </div>
                  </div>
                )}

                {isCameraActive && (
                  <div className="text-center space-y-4">
                    <div className="relative">
                      <video
                        ref={videoRef}
                        className="w-full max-w-md mx-auto rounded-lg shadow-lg"
                        autoPlay
                        muted
                        playsInline
                      />
                      <div className="absolute top-4 left-4 bg-blue-500 text-white px-2 py-1 rounded text-sm">
                        Camera Active
                      </div>
                    </div>
                    <div className="flex justify-center gap-2">
                      <Button
                        onClick={() => capturePhoto()}
                        className="bg-blue-500 hover:bg-blue-600 text-white"
                      >
                        <Camera className="w-5 h-5 mr-2" />
                        Capture Photo
                      </Button>
                      <Button
                        onClick={switchCamera}
                        variant="outline"
                        className="px-3"
                      >
                        <RefreshCw className="w-5 h-5" />
                      </Button>
                      <Button
                        onClick={stopCamera}
                        className="bg-red-600 hover:bg-red-700 text-white"
                      >
                        <Square className="w-5 h-5 mr-2" />
                        Stop Camera
                      </Button>
                    </div>
                  </div>
                )}

                {selectedFile && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg">
                      <span className="text-green-700 font-medium">
                        Photo captured: {selectedFile.name}
                      </span>
                      <Button
                        onClick={() => {
                          setSelectedFile(null);
                          if (isCameraActive) {
                            stopCamera();
                          }
                        }}
                        variant="outline"
                        size="sm"
                      >
                        <RotateCcw className="w-4 h-4 mr-1" />
                        Take Another
                      </Button>
                    </div>
                    {selectedFile.type.startsWith('image/') && (
                      <img
                        src={URL.createObjectURL(selectedFile)}
                        alt="Captured"
                        className="w-full max-w-md mx-auto rounded-lg shadow-lg"
                      />
                    )}
                  </div>
                )}

                <div className="mt-4">
                  <div className="text-center text-gray-500 mb-2">OR</div>
                  <label className="block">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleFileSelectInternal}
                      className="hidden"
                    />
                    <div className="w-full p-4 border-2 border-dashed border-gray-300 rounded-lg text-center cursor-pointer hover:border-purple-400 hover:bg-purple-50 transition-colors">
                      <Image className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                      <span className="text-gray-600">
                        {selectedFile && !isCameraActive ? selectedFile.name : 'Upload Image File'}
                      </span>
                    </div>
                  </label>
                </div>

                {/* Hidden canvas for photo capture */}
                <canvas ref={canvasRef} className="hidden" />
              </div>
            )}

            {/* Upload Button */}
            <div className="flex justify-end">
              <Button
                onClick={onUpload}
                disabled={uploading || !title || !location || 
                  (uploadMode === 'text' && !textContent) ||
                  (uploadMode !== 'text' && !selectedFile)}
                className="bg-purple-600 hover:bg-purple-700 text-white px-8 py-3 rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {uploading ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  'Upload Content'
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