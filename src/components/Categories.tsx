import React, { useState, useEffect, useRef } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, LogOut, Grid3X3, Calendar, User, FileText, Upload, MapPin, Type, Mic, Video, Image, X, Check, AlertCircle } from 'lucide-react';
import { toast } from "sonner";
import ContentInput from './ContentInput';

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
  const [location, setLocation] = useState<{ lat: number, lng: number } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [locationError, setLocationError] = useState('');
  const [locationRequested, setLocationRequested] = useState(false);
  const [showManualLocation, setShowManualLocation] = useState(false);
  const [manualLat, setManualLat] = useState('');
  const [manualLng, setManualLng] = useState('');
  const [userId, setUserId] = useState('');

  const uploadOptions: UploadOption[] = [
    {
      type: 'text',
      icon: <Type className="w-6 h-6" />,
      title: 'Text Input',
      description: 'Type your content',
      accept: ''
    },
    {
      type: 'audio',
      icon: <Mic className="w-6 h-6" />,
      title: 'Audio Recording',
      description: 'Record your voice',
      accept: 'audio/*'
    },
    {
      type: 'video',
      icon: <Video className="w-6 h-6" />,
      title: 'Video Content',
      description: 'Record or upload video',
      accept: 'video/*'
    },
    {
      type: 'image',
      icon: <Image className="w-6 h-6" />,
      title: 'Photo Capture',
      description: 'Take or upload photos',
      accept: 'image/*'
    }
  ];

  useEffect(() => {
    fetchCategories();
    fetchUserProfile();
  }, []);

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
        switch (error.code) {
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

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
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
    setSelectedCategory(null);
    setShowUploadOptions(false);
    setUploadMode(null);
    setTitle('');
    setTextContent('');
    setSelectedFile(null);
    setLocationRequested(false);
    setLocation(null);
    setLocationError('');
    setShowManualLocation(false);
    setManualLat('');
    setManualLng('');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading categories...</p>
        </div>
      </div>
    );
  }

  // Upload Interface - Use ContentInput component
  if (uploadMode && selectedCategory) {
    return (
      <ContentInput
        uploadMode={uploadMode}
        selectedCategory={selectedCategory}
        title={title}
        setTitle={setTitle}
        textContent={textContent}
        setTextContent={setTextContent}
        selectedFile={selectedFile}
        setSelectedFile={setSelectedFile}
        location={location}
        setLocation={setLocation}
        locationError={locationError}
        setLocationError={setLocationError}
        showManualLocation={showManualLocation}
        setShowManualLocation={setShowManualLocation}
        manualLat={manualLat}
        setManualLat={setManualLat}
        manualLng={manualLng}
        setManualLng={setManualLng}
        uploading={uploading}
        token={token}
        userId={userId}
        onBack={handleBack}
        onUpload={handleUpload}
        requestLocation={requestLocation}
        handleManualLocationSubmit={handleManualLocationSubmit}
        handleFileSelect={handleFileSelect}
      />
    );
  }

  // Upload Options Modal
  if (showUploadOptions && selectedCategory) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-indigo-100 p-4">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <Button
              onClick={handleBack}
              variant="ghost"
              className="flex items-center gap-2 text-gray-600 hover:text-gray-800"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </Button>
          </div>

          <Card className="shadow-xl border-0">
            <CardHeader className="text-center bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-t-lg">
              <CardTitle className="text-2xl font-bold">{selectedCategory.title}</CardTitle>
              <p className="text-purple-100 mt-2">Choose how you'd like to contribute</p>
            </CardHeader>

            <CardContent className="p-8">
              {/* Upload Options */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {uploadOptions.map((option) => (
                  <Card
                    key={option.type}
                    className="cursor-pointer hover:shadow-lg transition-all duration-200 border-2 hover:border-purple-300"
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
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Main Categories View
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-indigo-100 p-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <Card className="mb-8 shadow-lg border-0">
          <CardHeader className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-t-lg">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-3xl font-bold flex items-center gap-3">
                  <Grid3X3 className="w-8 h-8" />
                  Categories
                </CardTitle>
                <p className="text-purple-100 mt-2">Choose a category to contribute content</p>
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* Categories Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {categories.map((category) => (
            <Card
              key={category.id}
              className="cursor-pointer hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 border-0 shadow-lg"
              onClick={() => handleCategoryClick(category)}
            >
              <CardContent className="p-6">
                <div className="text-center">
                  <div className="text-4xl mb-4">
                    {getCategoryIcon(category.name)}
                  </div>
                  <h3 className="font-bold text-xl mb-2 text-gray-800">{category.title}</h3>
                  <p className="text-gray-600 text-sm leading-relaxed">{category.description}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Categories;
