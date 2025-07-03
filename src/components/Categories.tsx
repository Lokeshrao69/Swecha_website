import React, { useState, useEffect, useRef } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, LogOut, Grid3X3, Calendar, User, FileText, Upload, MapPin, Type, Mic, Video, Image, X, Check, AlertCircle, Camera, Square, Play, Pause, RotateCcw } from 'lucide-react';
import { toast } from "sonner";

// ADD THE JWT DECODER FUNCTION HERE - RIGHT AFTER IMPORTS
const decodeJWTToken = (token: string): any => {
  try {
    // JWT tokens have 3 parts separated by dots: header.payload.signature
    const parts = token.split('.');
    if (parts.length !== 3) {
      throw new Error('Invalid JWT token format');
    }

    // Decode the payload (second part)
    const payload = parts[1];
    
    // Add padding if needed (JWT base64 encoding might not have padding)
    const paddedPayload = payload + '='.repeat((4 - payload.length % 4) % 4);
    
    // Decode base64
    const decodedPayload = atob(paddedPayload);
    
    // Parse JSON
    return JSON.parse(decodedPayload);
  } catch (error) {
    console.error('Error decoding JWT token:', error);
    return null;
  }
};

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

interface CategoriesProps {
  token: string;
  onBack: () => void;
  onLogout: () => void;
  onProfile: () => void;
  onContentInput: (categoryId: string, categoryName: string) => void;
}

interface UploadOption {
  type: 'text' | 'audio' | 'video' | 'image';
  icon: React.ReactNode;
  title: string;
  description: string;
  accept: string;
}

const Categories: React.FC<CategoriesProps> = ({ token, onBack, onLogout, onProfile, onContentInput }) => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [showUploadOptions, setShowUploadOptions] = useState(false);
  const [uploadMode, setUploadMode] = useState<'text' | 'audio' | 'video' | 'image' | null>(null);
  const [title, setTitle] = useState('');
  const [textContent, setTextContent] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [location, setLocation] = useState<{lat: number, lng: number} | null>(null);
  const [uploading, setUploading] = useState(false);
  const [locationError, setLocationError] = useState('');
  const [locationRequested, setLocationRequested] = useState(false);
  const [showManualLocation, setShowManualLocation] = useState(false);
  const [manualLat, setManualLat] = useState('');
  const [manualLng, setManualLng] = useState('');
  const [userId, setUserId] = useState<string>('');

  // Recording states
  const [isRecording, setIsRecording] = useState(false);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [recordingTime, setRecordingTime] = useState(0);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const playbackVideoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const recordingInterval = useRef<NodeJS.Timeout | null>(null);

  const uploadOptions: UploadOption[] = [
    {
      type: 'text',
      icon: <Type className="h-8 w-8" />,
      title: 'Text Input',
      description: 'Type your content',
      accept: ''
    },
    {
      type: 'audio',
      icon: <Mic className="h-8 w-8" />,
      title: 'Audio Recording',
      description: 'Record your voice',
      accept: 'audio/*'
    },
    {
      type: 'video',
      icon: <Video className="h-8 w-8" />,
      title: 'Video Content',
      description: 'Record or upload video',
      accept: 'video/*'
    },
    {
      type: 'image',
      icon: <Camera className="h-8 w-8" />,
      title: 'Photo Capture',
      description: 'Take or upload photos',
      accept: 'image/*'
    }
  ];

  useEffect(() => {
    fetchCategories();
    fetchUserProfile();
  }, []);

  useEffect(() => {
    if (isRecording) {
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
  }, [isRecording]);

  // REPLACE YOUR EXISTING fetchUserProfile FUNCTION WITH THIS
  const fetchUserProfile = async () => {
    try {
      // First try to decode user ID from JWT token
      const tokenPayload = decodeJWTToken(token);
      if (tokenPayload) {
        console.log('JWT Token payload:', tokenPayload);
        // Common JWT payload fields for user ID
        const userId = tokenPayload.sub || tokenPayload.user_id || tokenPayload.id || tokenPayload.uid;
        if (userId) {
          console.log('User ID from token:', userId);
          setUserId(userId.toString());
          return; // Exit early if we got the user ID from token
        }
      }

      // Fallback: Try to fetch from API
      const response = await fetch('https://backend2.swecha.org/api/v1/users/profile', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const userData = await response.json();
        console.log('User profile response:', userData);
        
        // Try multiple possible field names for user ID
        const userId = userData.id || userData.uid || userData.user_id || userData.sub;
        if (userId) {
          setUserId(userId.toString());
        } else {
          console.error('User ID not found in profile response:', userData);
          toast.error("User ID not found. Please try logging in again.");
        }
      } else {
        console.error('Failed to fetch user profile, status:', response.status);
        const errorData = await response.json().catch(() => ({}));
        console.error('Profile fetch error:', errorData);
      }
    } catch (error) {
      console.error('User profile error:', error);
      toast.error("Failed to get user information. Please try logging in again.");
    }
  };

  const fetchCategories = async () => {
    try {
      const response = await fetch('https://backend2.swecha.org/api/v1/categories/', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        console.log('Categories Response:', data);
        const publishedCategories = data
          .filter((cat: Category) => cat.published)
          .sort((a: Category, b: Category) => a.rank - b.rank);
        setCategories(publishedCategories);
      } else {
        toast.error("Failed to fetch categories");
      }
    } catch (error) {
      console.error('Categories Error:', error);
      toast.error("Network error. Please try again.");
    }
    setLoading(false);
  };

  const getCategoryIcon = (name: string) => {
    const iconMap: { [key: string]: React.ReactNode } = {
      'fables': '📚',
      'events': '🎉',
      'music': '🎵',
      'places': '🏛️',
      'food': '🍽️',
      'people': '👥',
      'literature': '📖',
      'architecture': '🏗️',
      'skills': '⚡',
      'images': '🖼️',
      'culture': '🎭',
      'flora_&_fauna': '🌿',
      'education': '🎓',
      'vegetation': '🌱',
      'folk_songs': '🎶',
      'traditional_skills': '🛠️',
      'local_cultural_history': '🏛️',
      'local_history': '📜',
      'food_agriculture': '🌾',
      'old_newspapers': '📰',
      'folk tales': '📓'
    };
    return iconMap[name] || '📂';
  };

  const handleCategoryClick = (category: Category) => {
    setSelectedCategory(category);
    setShowUploadOptions(true);
  };

  const handleUploadOptionSelect = (option: UploadOption) => {
    setUploadMode(option.type);
    setShowUploadOptions(false);
    if (!locationRequested && !location) {
      requestLocation();
    }
  };

  const requestLocation = () => {
    setLocationError('');
    setLocationRequested(true);
    
    if (!navigator.geolocation) {
      setLocationError('Geolocation is not supported by this browser.');
      toast.error("Geolocation not supported");
      setShowManualLocation(true);
      return;
    }

    toast.info("Requesting location access...");

    navigator.geolocation.getCurrentPosition(
      (position) => {
        console.log('Location obtained:', position.coords);
        setLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude
        });
        setLocationError('');
        setShowManualLocation(false);
        toast.success("Location access granted!");
      },
      (error) => {
        console.error('Location error:', error);
        let errorMessage = 'Location access failed. ';
        
        switch(error.code) {
          case error.PERMISSION_DENIED:
            errorMessage += 'Please allow location access or enter manually.';
            break;
          case error.POSITION_UNAVAILABLE:
            errorMessage += 'Location information is unavailable.';
            break;
          case error.TIMEOUT:
            errorMessage += 'Location request timed out.';
            break;
          default:
            errorMessage += 'An unknown error occurred.';
            break;
        }
        
        setLocationError(errorMessage);
        toast.error(errorMessage);
        setShowManualLocation(true);
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 60000
      }
    );
  };

  const handleManualLocationSubmit = () => {
    const lat = parseFloat(manualLat);
    const lng = parseFloat(manualLng);
    
    if (isNaN(lat) || isNaN(lng)) {
      toast.error("Please enter valid latitude and longitude values");
      return;
    }
    
    if (lat < -90 || lat > 90) {
      toast.error("Latitude must be between -90 and 90");
      return;
    }
    
    if (lng < -180 || lng > 180) {
      toast.error("Longitude must be between -180 and 180");
      return;
    }
    
    setLocation({ lat, lng });
    setLocationError('');
    setShowManualLocation(false);
    toast.success("Location set manually!");
  };

  const startRecording = async (type: 'audio' | 'video') => {
    try {
      const constraints = type === 'audio' 
        ? { audio: true }
        : { audio: true, video: { facingMode: 'user' } };

      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      setStream(mediaStream);

      if (type === 'video' && videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }

      const recorder = new MediaRecorder(mediaStream);
      const chunks: BlobPart[] = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data);
        }
      };

      recorder.onstop = () => {
        const blob = new Blob(chunks, { 
          type: type === 'audio' ? 'audio/webm' : 'video/webm' 
        });
        setRecordedBlob(blob);
        setSelectedFile(new File([blob], `recorded-${type}.webm`, { 
          type: blob.type 
        }));
        
        // Create URL for playback
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
      setRecordingTime(0);
      
      toast.success(`${type === 'audio' ? 'Audio' : 'Video'} recording started`);
    } catch (error) {
      console.error('Recording error:', error);
      toast.error(`Failed to start ${type} recording. Please check permissions.`);
    }
  };

  const stopRecording = () => {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
      mediaRecorder.stop();
    }
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    setIsRecording(false);
    setMediaRecorder(null);
    toast.success('Recording stopped');
  };

  const capturePhoto = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'user' } 
      });
      
      if (videoRef.current && canvasRef.current) {
        videoRef.current.srcObject = mediaStream;
        videoRef.current.play();

        videoRef.current.onloadedmetadata = () => {
          const canvas = canvasRef.current!;
          const video = videoRef.current!;
          
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          
          const ctx = canvas.getContext('2d')!;
          ctx.drawImage(video, 0, 0);
          
          canvas.toBlob((blob) => {
            if (blob) {
              setSelectedFile(new File([blob], 'captured-photo.jpg', { type: 'image/jpeg' }));
              toast.success('Photo captured!');
            }
          }, 'image/jpeg', 0.9);
          
          mediaStream.getTracks().forEach(track => track.stop());
        };
      }
    } catch (error) {
      console.error('Photo capture error:', error);
      toast.error('Failed to capture photo. Please check camera permissions.');
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setRecordedBlob(null);
      setAudioUrl(null);
      setVideoUrl(null);
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
    setAudioUrl(null);
    setVideoUrl(null);
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    if (videoUrl) URL.revokeObjectURL(videoUrl);
  };

  const handleUpload = async () => {
    if (!selectedCategory || !title.trim()) {
      toast.error("Please provide a title");
      return;
    }

    if (!location) {
      toast.error("Location is required. Please enable location access or enter manually.");
      if (!showManualLocation) {
        setShowManualLocation(true);
      }
      return;
    }

    if (!userId) {
      toast.error("User ID not found. Please try logging in again.");
      return;
    }

    // For text uploads, create a text file
    let fileToUpload = selectedFile;
    if (uploadMode === 'text') {
      if (!textContent.trim()) {
        toast.error("Please enter text content");
        return;
      }
      // Create a text file from the content
      const textBlob = new Blob([textContent], { type: 'text/plain' });
      fileToUpload = new File([textBlob], 'text-content.txt', { type: 'text/plain' });
    } else if (!selectedFile) {
      toast.error("Please select a file or record content");
      return;
    }

    setUploading(true);

    try {
      const formData = new FormData();
      formData.append('title', title);
      formData.append('category_id', selectedCategory.id);
      formData.append('user_id', userId);
      formData.append('media_type', uploadMode || '');
      formData.append('latitude', location.lat.toString());
      formData.append('longitude', location.lng.toString());
      formData.append('use_uid_filename', 'false');
      
      if (fileToUpload) {
        formData.append('file', fileToUpload);
      }

      // Use the single upload endpoint
      const endpoint = 'https://backend2.swecha.org/api/v1/records/upload';

      console.log('Uploading to:', endpoint);
      console.log('Form data entries:');
      for (let [key, value] of formData.entries()) {
        console.log(key, value);
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formData,
      });

      if (response.ok) {
        const result = await response.json();
        console.log('Upload successful:', result);
        toast.success("Content uploaded successfully!");
        handleBack();
      } else {
        const errorData = await response.json().catch(() => ({ detail: 'Upload failed' }));
        console.error('Upload failed:', errorData);
        toast.error(errorData.detail || errorData.message || "Upload failed. Please try again.");
      }
    } catch (error) {
      console.error('Upload error:', error);
      toast.error("Network error. Please check your connection and try again.");
    }

    setUploading(false);
  };

  const handleBack = () => {
    if (isRecording) {
      stopRecording();
    }
    
    // Clean up URLs
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    if (videoUrl) URL.revokeObjectURL(videoUrl);
    
    setSelectedCategory(null);
    setShowUploadOptions(false);
    setUploadMode(null);
    setTitle('');
    setTextContent('');
    setSelectedFile(null);
    setRecordedBlob(null);
    setRecordingTime(0);
    setLocationRequested(false);
    setLocation(null);
    setLocationError('');
    setShowManualLocation(false);
    setManualLat('');
    setManualLng('');
    setAudioUrl(null);
    setVideoUrl(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  // Upload Interface
  if (uploadMode && selectedCategory) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
        {/* Header */}
        <div className="gradient-purple text-white p-4 sm:p-6 rounded-b-3xl shadow-xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="icon"
                className="text-white hover:bg-white/20 w-10 h-10 rounded-full"
                onClick={handleBack}
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold mb-1">
                  {uploadOptions.find(opt => opt.type === uploadMode)?.title}
                </h1>
                <p className="text-purple-100 text-sm sm:text-base">
                  {selectedCategory.title}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Upload Form */}
        <div className="px-4 sm:px-6 py-6 sm:py-8">
          <Card className="max-w-2xl mx-auto shadow-lg border-0 rounded-2xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-3">
                {uploadOptions.find(opt => opt.type === uploadMode)?.icon}
                Upload Content
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Title Input */}
              <div>
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
              <div className="space-y-4">
                <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
                  <MapPin className="h-5 w-5 text-gray-600" />
                  <span className="text-sm text-gray-600 flex-1">
                    {location ? (
                      <span className="flex items-center gap-2">
                        <Check className="h-4 w-4 text-green-500" />
                        Location: {location.lat.toFixed(4)}, {location.lng.toFixed(4)}
                      </span>
                    ) : locationError ? (
                      <span className="flex items-center gap-2 text-red-600">
                        <AlertCircle className="h-4 w-4" />
                        {locationError}
                      </span>
                    ) : (
                      "Location required"
                    )}
                  </span>
                  {!location && (
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={requestLocation}
                      >
                        Get Location
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowManualLocation(!showManualLocation)}
                      >
                        Manual
                      </Button>
                    </div>
                  )}
                </div>

                {/* Manual Location Input */}
                {showManualLocation && (
                  <div className="p-4 border border-gray-200 rounded-lg bg-white">
                    <h3 className="font-medium text-gray-700 mb-3">Enter Location Manually</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">Latitude</label>
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
                        <label className="block text-xs text-gray-600 mb-1">Longitude</label>
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
                    <div className="flex gap-2 mt-3">
                      <Button
                        size="sm"
                        onClick={handleManualLocationSubmit}
                        className="bg-purple-600 hover:bg-purple-700 text-white"
                      >
                        Set Location
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowManualLocation(false)}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              {/* Content Input based on type */}
              {uploadMode === 'text' && (
                <div>
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
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Audio Recording *
                  </label>
                  <div className="space-y-4">
                    {!isRecording && !recordedBlob && (
                      <Button
                        onClick={() => startRecording('audio')}
                        className="w-full bg-red-500 hover:bg-red-600 text-white py-3 rounded-lg"
                      >
                        <Mic className="h-5 w-5 mr-2" />
                        Start Recording
                      </Button>
                    )}
                    
                    {isRecording && (
                      <div className="text-center space-y-4">
                        <div className="flex items-center justify-center gap-4">
                          <div className="w-4 h-4 bg-red-500 rounded-full animate-pulse"></div>
                          <div className="text-2xl font-bold text-red-500">
                            {formatTime(recordingTime)}
                          </div>
                        </div>
                        <Button
                          onClick={stopRecording}
                          className="bg-gray-500 hover:bg-gray-600 text-white"
                        >
                          <Square className="h-5 w-5 mr-2" />
                          Stop Recording
                        </Button>
                      </div>
                    )}
                    
                    {recordedBlob && audioUrl && (
                      <div className="space-y-3">
                        <div className="p-3 bg-green-50 rounded-lg">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm text-green-700">Recording completed ({formatTime(recordingTime)})</span>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={resetRecording}
                            >
                              <RotateCcw className="h-4 w-4 mr-1" />
                              Record Again
                            </Button>
                          </div>
                          <audio controls className="w-full">
                            <source src={audioUrl} type="audio/webm" />
                            Your browser does not support the audio element.
                          </audio>
                        </div>
                      </div>
                    )}
                    
                    <div className="text-center text-sm text-gray-500">OR</div>
                    
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                      <input
                        type="file"
                        accept="audio/*"
                        onChange={handleFileSelect}
                        className="hidden"
                        id="audio-upload"
                      />
                      <label htmlFor="audio-upload" className="cursor-pointer">
                        <Upload className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                        <p className="text-gray-600">
                          {selectedFile && !recordedBlob ? selectedFile.name : 'Upload Audio File'}
                        </p>
                      </label>
                    </div>
                  </div>
                </div>
              )}

              {uploadMode === 'video' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Video Recording *
                  </label>
                  <div className="space-y-4">
                    {isRecording && (
                      <video
                        ref={videoRef}
                        autoPlay
                        muted
                        className="w-full rounded-lg bg-black"
                        style={{ maxHeight: '300px' }}
                      />
                    )}
                    
                    {!isRecording && !recordedBlob && (
                      <Button
                        onClick={() => startRecording('video')}
                        className="w-full bg-red-500 hover:bg-red-600 text-white py-3 rounded-lg"
                      >
                        <Video className="h-5 w-5 mr-2" />
                        Start Video Recording
                      </Button>
                    )}
                    
                    {isRecording && (
                      <div className="text-center space-y-4">
                        <div className="flex items-center justify-center gap-4">
                          <div className="w-4 h-4 bg-red-500 rounded-full animate-pulse"></div>
                          <div className="text-2xl font-bold text-red-500">
                            {formatTime(recordingTime)}
                          </div>
                        </div>
                        <Button
                          onClick={stopRecording}
                          className="bg-gray-500 hover:bg-gray-600 text-white"
                        >
                          <Square className="h-5 w-5 mr-2" />
                          Stop Recording
                        </Button>
                      </div>
                    )}
                    
                    {recordedBlob && videoUrl && (
                      <div className="space-y-3">
                        <div className="p-3 bg-green-50 rounded-lg">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm text-green-700">Video recorded ({formatTime(recordingTime)})</span>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={resetRecording}
                            >
                              <RotateCcw className="h-4 w-4 mr-1" />
                              Record Again
                            </Button>
                          </div>
                          <video
                            ref={playbackVideoRef}
                            controls
                            className="w-full rounded-lg"
                            style={{ maxHeight: '300px' }}
                          >
                           <source src={videoUrl} type="video/webm" />
                            Your browser does not support the video element.
                          </video>
                        </div>
                      </div>
                    )}
                    
                    <div className="text-center text-sm text-gray-500">OR</div>
                    
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                      <input
                        type="file"
                        accept="video/*"
                        onChange={handleFileSelect}
                        className="hidden"
                        id="video-upload"
                      />
                      <label htmlFor="video-upload" className="cursor-pointer">
                        <Upload className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                        <p className="text-gray-600">
                          {selectedFile && !recordedBlob ? selectedFile.name : 'Upload Video File'}
                        </p>
                      </label>
                    </div>
                  </div>
                </div>
              )}

              {uploadMode === 'image' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Image Capture *
                  </label>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <Button
                        onClick={capturePhoto}
                        className="w-full bg-blue-500 hover:bg-blue-600 text-white py-3 rounded-lg"
                      >
                        <Camera className="h-5 w-5 mr-2" />
                        Take Photo
                      </Button>
                      
                      <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleFileSelect}
                          className="hidden"
                          id="image-upload"
                        />
                        <label htmlFor="image-upload" className="cursor-pointer">
                          <Upload className="h-6 w-6 text-gray-400 mx-auto mb-1" />
                          <p className="text-xs text-gray-600">Upload Image</p>
                        </label>
                      </div>
                    </div>
                    
                    {selectedFile && (
                      <div className="p-3 bg-green-50 rounded-lg">
                        <p className="text-sm text-green-700 mb-2">Selected: {selectedFile.name}</p>
                        {selectedFile.type.startsWith('image/') && (
                          <img
                            src={URL.createObjectURL(selectedFile)}
                            alt="Preview"
                            className="w-full max-h-48 object-cover rounded-lg"
                          />
                        )}
                      </div>
                    )}
                    
                    <video
                      ref={videoRef}
                      className="hidden"
                      autoPlay
                      muted
                    />
                    <canvas
                      ref={canvasRef}
                      className="hidden"
                    />
                  </div>
                </div>
              )}

              {/* Upload Button */}
              <div className="flex gap-3 pt-4">
                <Button
                  variant="outline"
                  onClick={handleBack}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleUpload}
                  disabled={uploading}
                  className="flex-1 bg-purple-600 hover:bg-purple-700 text-white"
                >
                  {uploading ? (
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Uploading...
                    </div>
                  ) : (
                    <>
                      <Upload className="h-4 w-4 mr-2" />
                      Upload
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Upload Options Modal
  if (showUploadOptions && selectedCategory) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
        {/* Header */}
        <div className="gradient-purple text-white p-4 sm:p-6 rounded-b-3xl shadow-xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="icon"
                className="text-white hover:bg-white/20 w-10 h-10 rounded-full"
                onClick={handleBack}
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold mb-1">
                  {selectedCategory.title}
                </h1>
                <p className="text-purple-100 text-sm sm:text-base">
                  Choose how you'd like to contribute
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Upload Options */}
        <div className="px-4 sm:px-6 py-6 sm:py-8">
          <div className="max-w-2xl mx-auto">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {uploadOptions.map((option) => (
                <Card
                  key={option.type}
                  className="cursor-pointer hover:shadow-lg transition-all duration-200 border-2 hover:border-purple-300 rounded-2xl"
                  onClick={() => handleUploadOptionSelect(option)}
                >
                  <CardContent className="p-6 text-center">
                    <div className="text-purple-600 mb-4 flex justify-center">
                      {option.icon}
                    </div>
                    <h3 className="font-semibold text-lg mb-2">{option.title}</h3>
                    <p className="text-gray-600 text-sm">{option.description}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Main Categories View
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      {/* Header */}
      <div className="gradient-purple text-white p-4 sm:p-6 rounded-b-3xl shadow-xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              className="text-white hover:bg-white/20 w-10 h-10 rounded-full"
              onClick={onBack}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold mb-1">Categories</h1>
              <p className="text-purple-100 text-sm sm:text-base">
                Choose a category to contribute content
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="text-white hover:bg-white/20 w-10 h-10 rounded-full"
              onClick={onProfile}
            >
              <User className="h-5 w-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="text-white hover:bg-white/20 w-10 h-10 rounded-full"
              onClick={onLogout}
            >
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </div>

      {/* Categories Grid */}
      <div className="px-4 sm:px-6 py-6 sm:py-8">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
            {categories.map((category) => (
              <Card
                key={category.id}
                className="cursor-pointer hover:shadow-lg transition-all duration-200 border-0 rounded-2xl overflow-hidden hover:scale-105"
                onClick={() => handleCategoryClick(category)}
              >
                <CardContent className="p-6">
                  <div className="text-4xl mb-4 text-center">
                    {getCategoryIcon(category.name)}
                  </div>
                  <h3 className="font-semibold text-lg mb-2 text-center text-gray-800">
                    {category.title}
                  </h3>
                  <p className="text-gray-600 text-sm text-center line-clamp-3">
                    {category.description}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Categories;