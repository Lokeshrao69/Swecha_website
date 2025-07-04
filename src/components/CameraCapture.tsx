
import React, { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Check, Type, Mic, MicOff, Play, Square, Trash2, Camera, Image, Video, MapPin } from 'lucide-react';
import { toast } from "sonner";

interface ContentInputProps {
  token: string;
  onBack: () => void;
  categoryId?: string;
  categoryName?: string;
}

const ContentInput: React.FC<ContentInputProps> = ({ token, onBack, categoryId, categoryName }) => {
  const [selectedCategory, setSelectedCategory] = useState<string>(categoryName || 'People');
  const [inputMethod, setInputMethod] = useState<'text' | 'audio' | 'video' | 'image' | null>(null);
  const [textContent, setTextContent] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [videoBlob, setVideoBlob] = useState<Blob | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [recordingTime, setRecordingTime] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [location, setLocation] = useState<{latitude: number, longitude: number} | null>(null);
  const [locationPermission, setLocationPermission] = useState<'granted' | 'denied' | 'prompt'>('prompt');
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const videoRecorderRef = useRef<MediaRecorder | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      if (audioUrl) URL.revokeObjectURL(audioUrl);
      if (videoUrl) URL.revokeObjectURL(videoUrl);
      if (imageUrl) URL.revokeObjectURL(imageUrl);
    };
  }, [audioUrl, videoUrl, imageUrl]);

  const requestLocationPermission = async () => {
    if (!navigator.geolocation) {
      toast.error("Geolocation is not supported by this browser");
      return false;
    }

    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 300000
        });
      });

      setLocation({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude
      });
      setLocationPermission('granted');
      toast.success("Location permission granted");
      return true;
    } catch (error) {
      console.error('Location error:', error);
      setLocationPermission('denied');
      toast.error("Location permission denied. Please enable location access.");
      return false;
    }
  };

  const startAudioRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        setAudioBlob(blob);
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);

      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);

      toast.success("Audio recording started");
    } catch (error) {
      toast.error("Failed to start audio recording. Please check microphone permissions.");
    }
  };

  const startVideoRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      videoRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'video/webm' });
        setVideoBlob(blob);
        const url = URL.createObjectURL(blob);
        setVideoUrl(url);
        stream.getTracks().forEach(track => track.stop());
        if (videoRef.current) {
          videoRef.current.srcObject = null;
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);

      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);

      toast.success("Video recording started");
    } catch (error) {
      toast.error("Failed to start video recording. Please check camera permissions.");
    }
  };

  const stopRecording = () => {
    if (inputMethod === 'audio' && mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
    } else if (inputMethod === 'video' && videoRecorderRef.current && isRecording) {
      videoRecorderRef.current.stop();
    }
    
    setIsRecording(false);
    
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    
    toast.success("Recording completed");
  };

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setImageFile(file);
      const url = URL.createObjectURL(file);
      setImageUrl(url);
      toast.success("Image selected");
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleSubmit = async () => {
    if (!inputMethod) {
      toast.error("Please select an input method");
      return;
    }

    if (inputMethod === 'text' && !textContent.trim()) {
      toast.error("Please enter some text content");
      return;
    }

    if (inputMethod === 'audio' && !audioBlob) {
      toast.error("Please record some audio content");
      return;
    }

    if (inputMethod === 'video' && !videoBlob) {
      toast.error("Please record some video content");
      return;
    }

    if (inputMethod === 'image' && !imageFile) {
      toast.error("Please select an image");
      return;
    }

    // Request location permission before submission
    const hasLocation = await requestLocationPermission();
    if (!hasLocation) {
      toast.error("Location permission is required for submission");
      return;
    }

    setIsSubmitting(true);

    try {
      const formData = new FormData();
      formData.append('category_id', categoryId || '');
      formData.append('content_type', inputMethod);
      
      if (location) {
        formData.append('latitude', location.latitude.toString());
        formData.append('longitude', location.longitude.toString());
      }

      if (inputMethod === 'text') {
        formData.append('text_content', textContent);
      } else if (inputMethod === 'audio' && audioBlob) {
        formData.append('audio_file', audioBlob, 'recording.webm');
      } else if (inputMethod === 'video' && videoBlob) {
        formData.append('video_file', videoBlob, 'recording.webm');
      } else if (inputMethod === 'image' && imageFile) {
        formData.append('image_file', imageFile);
      }

      const response = await fetch('https://backend2.swecha.org/api/v1/content/submit', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formData,
      });

      if (response.ok) {
        toast.success(`Content submitted successfully!`);
        
        // Reset form
        setTextContent('');
        setAudioBlob(null);
        setVideoBlob(null);
        setImageFile(null);
        setAudioUrl(null);
        setVideoUrl(null);
        setImageUrl(null);
        setInputMethod(null);
        setRecordingTime(0);
      } else {
        const errorData = await response.json();
        toast.error(errorData.detail || "Failed to submit content");
      }
    } catch (error) {
      toast.error("Network error. Please try again.");
    }

    setIsSubmitting(false);
  };

  if (!inputMethod) {
    return (
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <div className="bg-white border-b p-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={onBack}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-xl font-semibold">Choose Input Method</h1>
              <p className="text-sm text-gray-600">How would you like to share your content?</p>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Selected Category */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col items-center space-y-4">
                <div className="w-16 h-16 gradient-purple rounded-2xl flex items-center justify-center">
                  <Check className="h-8 w-8 text-white" />
                </div>
                <div className="text-center">
                  <p className="text-gray-600 mb-2">Selected Category</p>
                  <Badge className="gradient-purple text-white px-4 py-2 text-lg">
                    {selectedCategory}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Location Permission */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3 p-4 bg-blue-50 rounded-lg">
                <MapPin className="h-5 w-5 text-blue-600" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-blue-800">Location Required</p>
                  <p className="text-xs text-blue-600">Location permission will be requested before submission</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Input Method Selection */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Type className="h-5 w-5 text-purple-500" />
              <h2 className="text-lg font-semibold">Select Input Method</h2>
            </div>
            <p className="text-sm text-gray-600 mb-4">Choose how you want to add your content</p>

            <div className="grid grid-cols-2 gap-4">
              {/* Text Input */}
              <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => setInputMethod('text')}>
                <CardContent className="pt-6">
                  <div className="flex flex-col items-center space-y-4">
                    <div className="w-16 h-16 bg-green-100 rounded-2xl flex items-center justify-center">
                      <Type className="h-8 w-8 text-green-600" />
                    </div>
                    <div className="text-center">
                      <h3 className="font-semibold text-lg">Text</h3>
                      <p className="text-gray-600 text-sm">Type your content</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Audio Recording */}
              <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => setInputMethod('audio')}>
                <CardContent className="pt-6">
                  <div className="flex flex-col items-center space-y-4">
                    <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center">
                      <Mic className="h-8 w-8 text-blue-600" />
                    </div>
                    <div className="text-center">
                      <h3 className="font-semibold text-lg">Audio</h3>
                      <p className="text-gray-600 text-sm">Record your voice</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Video Recording */}
              <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => setInputMethod('video')}>
                <CardContent className="pt-6">
                  <div className="flex flex-col items-center space-y-4">
                    <div className="w-16 h-16 bg-red-100 rounded-2xl flex items-center justify-center">
                      <Video className="h-8 w-8 text-red-600" />
                    </div>
                    <div className="text-center">
                      <h3 className="font-semibold text-lg">Video</h3>
                      <p className="text-gray-600 text-sm">Record a video</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Image Upload */}
              <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => setInputMethod('image')}>
                <CardContent className="pt-6">
                  <div className="flex flex-col items-center space-y-4">
                    <div className="w-16 h-16 bg-orange-100 rounded-2xl flex items-center justify-center">
                      <Image className="h-8 w-8 text-orange-600" />
                    </div>
                    <div className="text-center">
                      <h3 className="font-semibold text-lg">Image</h3>
                      <p className="text-gray-600 text-sm">Upload a picture</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b p-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => setInputMethod(null)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-xl font-semibold">
              {inputMethod === 'text' && 'Text Input'}
              {inputMethod === 'audio' && 'Audio Recording'}
              {inputMethod === 'video' && 'Video Recording'}
              {inputMethod === 'image' && 'Image Upload'}
            </h1>
            <p className="text-sm text-gray-600">Category: {selectedCategory}</p>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Text Input */}
        {inputMethod === 'text' && (
          <Card className="animate-fade-in-up">
            <CardHeader>
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Type className="h-5 w-5 text-green-600" />
                Enter Your Content
              </h3>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                placeholder="Type your content here..."
                value={textContent}
                onChange={(e) => setTextContent(e.target.value)}
                rows={8}
                className="resize-none"
              />
              <div className="flex justify-between items-center text-sm text-gray-500">
                <span>Words: {textContent.split(' ').filter(word => word.length > 0).length}</span>
                <span>Characters: {textContent.length}</span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Audio Recording */}
        {inputMethod === 'audio' && (
          <Card className="animate-fade-in-up">
            <CardHeader>
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Mic className="h-5 w-5 text-blue-600" />
                Record Your Audio
              </h3>
            </CardHeader>
            <CardContent className="space-y-6">
              {!audioUrl && (
                <div className="flex flex-col items-center space-y-4">
                  <div className={`w-24 h-24 rounded-full flex items-center justify-center transition-all ${
                    isRecording ? 'bg-red-100 animate-pulse' : 'bg-blue-100'
                  }`}>
                    {isRecording ? (
                      <MicOff className="h-12 w-12 text-red-600" />
                    ) : (
                      <Mic className="h-12 w-12 text-blue-600" />
                    )}
                  </div>
                  
                  {isRecording && (
                    <div className="text-center">
                      <div className="text-2xl font-mono font-bold text-red-600">
                        {formatTime(recordingTime)}
                      </div>
                      <p className="text-sm text-gray-600">Recording in progress...</p>
                    </div>
                  )}

                  <Button
                    onClick={isRecording ? stopRecording : startAudioRecording}
                    className={`px-8 py-3 text-white ${
                      isRecording 
                        ? 'bg-red-500 hover:bg-red-600' 
                        : 'gradient-purple hover:opacity-90'
                    }`}
                  >
                    {isRecording ? (
                      <>
                        <Square className="h-5 w-5 mr-2" />
                        Stop Recording
                      </>
                    ) : (
                      <>
                        <Mic className="h-5 w-5 mr-2" />
                        Start Recording
                      </>
                    )}
                  </Button>
                </div>
              )}

              {audioUrl && (
                <div className="space-y-4">
                  <div className="bg-green-50 p-4 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Check className="h-5 w-5 text-green-600" />
                        <span className="text-green-700 font-medium">Recording completed</span>
                      </div>
                      <span className="text-sm text-green-600">{formatTime(recordingTime)}</span>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button onClick={() => audioUrl && new Audio(audioUrl).play()} variant="outline" className="flex-1">
                      <Play className="h-4 w-4 mr-2" />
                      Play
                    </Button>
                    <Button onClick={() => {
                      if (audioUrl) URL.revokeObjectURL(audioUrl);
                      setAudioUrl(null);
                      setAudioBlob(null);
                      setRecordingTime(0);
                    }} variant="outline" className="flex-1">
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Video Recording */}
        {inputMethod === 'video' && (
          <Card className="animate-fade-in-up">
            <CardHeader>
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Video className="h-5 w-5 text-red-600" />
                Record Your Video
              </h3>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="aspect-video bg-black rounded-lg overflow-hidden">
                <video
                  ref={videoRef}
                  className="w-full h-full object-cover"
                  muted
                  playsInline
                />
              </div>

              {!videoUrl && (
                <div className="flex flex-col items-center space-y-4">
                  {isRecording && (
                    <div className="text-center">
                      <div className="text-2xl font-mono font-bold text-red-600">
                        {formatTime(recordingTime)}
                      </div>
                      <p className="text-sm text-gray-600">Recording in progress...</p>
                    </div>
                  )}

                  <Button
                    onClick={isRecording ? stopRecording : startVideoRecording}
                    className={`px-8 py-3 text-white ${
                      isRecording 
                        ? 'bg-red-500 hover:bg-red-600' 
                        : 'gradient-purple hover:opacity-90'
                    }`}
                  >
                    {isRecording ? (
                      <>
                        <Square className="h-5 w-5 mr-2" />
                        Stop Recording
                      </>
                    ) : (
                      <>
                        <Video className="h-5 w-5 mr-2" />
                        Start Recording
                      </>
                    )}
                  </Button>
                </div>
              )}

              {videoUrl && (
                <div className="space-y-4">
                  <div className="bg-green-50 p-4 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Check className="h-5 w-5 text-green-600" />
                        <span className="text-green-700 font-medium">Video recorded</span>
                      </div>
                      <span className="text-sm text-green-600">{formatTime(recordingTime)}</span>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button onClick={() => {
                      if (videoRef.current && videoUrl) {
                        videoRef.current.src = videoUrl;
                        videoRef.current.play();
                      }
                    }} variant="outline" className="flex-1">
                      <Play className="h-4 w-4 mr-2" />
                      Play
                    </Button>
                    <Button onClick={() => {
                      if (videoUrl) URL.revokeObjectURL(videoUrl);
                      setVideoUrl(null);
                      setVideoBlob(null);
                      setRecordingTime(0);
                    }} variant="outline" className="flex-1">
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Image Upload */}
        {inputMethod === 'image' && (
          <Card className="animate-fade-in-up">
            <CardHeader>
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Image className="h-5 w-5 text-orange-600" />
                Upload Your Image
              </h3>
            </CardHeader>
            <CardContent className="space-y-6">
              <input
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                ref={fileInputRef}
                className="hidden"
              />

              {!imageUrl && (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer hover:border-orange-400 transition-colors"
                >
                  <Image className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600 mb-2">Click to select an image</p>
                  <p className="text-sm text-gray-500">PNG, JPG, GIF up to 10MB</p>
                </div>
              )}

              {imageUrl && (
                <div className="space-y-4">
                  <div className="aspect-video bg-gray-100 rounded-lg overflow-hidden">
                    <img
                      src={imageUrl}
                      alt="Uploaded"
                      className="w-full h-full object-contain"
                    />
                  </div>

                  <div className="bg-green-50 p-4 rounded-lg">
                    <div className="flex items-center gap-2">
                      <Check className="h-5 w-5 text-green-600" />
                      <span className="text-green-700 font-medium">Image selected</span>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button onClick={() => fileInputRef.current?.click()} variant="outline" className="flex-1">
                      <Image className="h-4 w-4 mr-2" />
                      Change Image
                    </Button>
                    <Button onClick={() => {
                      if (imageUrl) URL.revokeObjectURL(imageUrl);
                      setImageUrl(null);
                      setImageFile(null);
                    }} variant="outline" className="flex-1">
                      <Trash2 className="h-4 w-4 mr-2" />
                      Remove
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Submit Button */}
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t">
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || 
              (inputMethod === 'text' && !textContent.trim()) || 
              (inputMethod === 'audio' && !audioBlob) ||
              (inputMethod === 'video' && !videoBlob) ||
              (inputMethod === 'image' && !imageFile)
            }
            className="w-full h-12 gradient-purple text-white hover:opacity-90 transition-opacity"
          >
            {isSubmitting ? "Submitting..." : "Submit Content"}
          </Button>
        </div>

        {/* Success Message Area */}
        <div className="h-20"></div>
      </div>
    </div>
  );
};

export default ContentInput;
