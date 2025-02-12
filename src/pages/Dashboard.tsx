import React, { useCallback, useState, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { FileText, Upload, AlertCircle, LogOut } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { uploadContract, getUserContracts } from '../lib/db';
import type { Contract, Risk } from '../types/contract';
import { toast } from 'react-hot-toast';

export default function Dashboard() {
  const { currentUser, logout } = useAuth();
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [lastVisible, setLastVisible] = useState<any>(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const loadContracts = async (loadMore = false) => {
    if (currentUser) {
      try {
        setIsLoadingMore(loadMore);
        const result = await getUserContracts(currentUser.uid, loadMore ? lastVisible : undefined);
        setContracts(prev => loadMore ? [...prev, ...result.contracts] : result.contracts);
        setHasMore(result.hasMore);
        setLastVisible(result.lastVisible);
      } catch (error) {
        console.error('Error loading contracts:', error);
        toast.error('Failed to load contracts');
      } finally {
        setIsLoadingMore(false);
        setIsLoading(false);
      }
    }
  };

  useEffect(() => {
    loadContracts();
  }, [currentUser]);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const uploadedFile = acceptedFiles[0];
    if (uploadedFile && currentUser) {
      if (uploadedFile.size > 10 * 1024 * 1024) {
        toast.error('File size must be less than 10MB');
        return;
      }
      
      setIsUploading(true);
      try {
        const contract = await uploadContract(uploadedFile, currentUser.uid);
        setContracts(prev => [contract, ...prev]);
        toast.success('Contract uploaded and analyzed successfully!');
      } catch (error: any) {
        console.error('Error uploading contract:', error);
        toast.error(error.message || 'Failed to upload and analyze contract. Please try again.');
      } finally {
        setIsUploading(false);
      }
    }
  }, [currentUser]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf']
    },
    maxFiles: 1,
    disabled: isUploading
  });

  const renderRisk = (risk: Risk) => (
    <div className="border-l-4 border-red-500 pl-4 mb-4">
      <h4 className="font-semibold text-red-700">{risk.location}</h4>
      <p className="text-gray-700 mt-1">{risk.description}</p>
      <div className="mt-2">
        <p className="text-sm font-medium text-gray-600">Suggested Improvement:</p>
        <p className="text-gray-800 mt-1">{risk.rewordedClause}</p>
      </div>
      <div className="mt-2">
        <p className="text-sm font-medium text-gray-600">Legal Advice:</p>
        <p className="text-gray-800 mt-1">{risk.legalAdvice}</p>
      </div>
    </div>
  );

  const renderAnalysis = (contract: Contract) => {
    if (!contract.analysis) {
      return (
        <div className="mt-4 text-center text-gray-600">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-2">Analyzing your contract...</p>
        </div>
      );
    }

    return (
      <div className="space-y-6 mt-4">
        {contract.analysis.risks && contract.analysis.risks.length > 0 && (
          <div className="border-t pt-4">
            <h3 className="text-lg font-semibold mb-4 flex items-center">
              <AlertCircle className="h-5 w-5 text-red-500 mr-2" />
              Potential Risks
            </h3>
            <div className="space-y-4">
              {contract.analysis.risks.map((risk, index) => (
                <div key={index}>{renderRisk(risk)}</div>
              ))}
            </div>
          </div>
        )}

        {contract.analysis.recommendations && contract.analysis.recommendations.length > 0 && (
          <div className="border-t pt-4">
            <h3 className="text-lg font-semibold mb-2">Recommendations</h3>
            <ul className="list-disc pl-5 space-y-2">
              {contract.analysis.recommendations.map((rec, index) => (
                <li key={index} className="text-gray-700">{rec}</li>
              ))}
            </ul>
          </div>
        )}

        {contract.analysis.keyPoints && contract.analysis.keyPoints.length > 0 && (
          <div className="border-t pt-4">
            <h3 className="text-lg font-semibold mb-2">Key Points</h3>
            <ul className="list-disc pl-5 space-y-2">
              {contract.analysis.keyPoints.map((point, index) => (
                <li key={index} className="text-gray-700">{point}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50">
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <FileText className="h-8 w-8 text-indigo-600" />
              <h1 className="text-2xl font-bold text-gray-900">ContractWise</h1>
            </div>
            <button
              onClick={logout}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
            >
              <LogOut className="h-4 w-4 mr-2" />
              Sign out
            </button>
          </div>
        </div>
      </header>
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="bg-white rounded-lg shadow-xl p-8">
          <div 
            {...getRootProps()} 
            className={`border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-colors ${
              isUploading ? 'opacity-50 cursor-not-allowed' : ''
            } ${isDragActive ? 'border-indigo-500 bg-indigo-50' : 'border-gray-300 hover:border-indigo-400'}`}
          >
            <input {...getInputProps()} disabled={isUploading} />
            <Upload className={`mx-auto h-12 w-12 ${isUploading ? 'text-gray-300' : 'text-gray-400'}`} />
            <p className="mt-4 text-lg text-gray-600">
              {isUploading ? 'Uploading and analyzing contract...' : (isDragActive ? 'Drop your contract here' : 'Drag & drop your contract, or click to select')}
            </p>
            <p className="mt-2 text-sm text-gray-500">
              Supported format: PDF (up to 10MB)
            </p>
          </div>

          {isLoading ? (
            <div className="mt-8 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
              <p className="mt-2 text-gray-600">Loading your contracts...</p>
            </div>
          ) : contracts && contracts.length > 0 ? (
            <div className="mt-8 space-y-6">
              <h2 className="text-xl font-semibold mb-4">Your Contracts</h2>
              {contracts.map((contract) => (
                <div key={contract.id} className="border rounded-lg p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-3">
                      <FileText className="h-6 w-6 text-indigo-600" />
                      <span className="font-medium">{contract.fileName}</span>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-sm ${
                      contract.status === 'analyzed' ? 'bg-green-100 text-green-800' : 
                      contract.status === 'error' ? 'bg-red-100 text-red-800' :
                      'bg-yellow-100 text-yellow-800'
                    }`}>
                      {contract.status === 'analyzed' ? 'Analyzed' : 
                       contract.status === 'error' ? 'Error' : 
                       'Analyzing...'}
                    </span>
                  </div>
                  
                  {contract.status === 'error' ? (
                    <div className="mt-4 text-red-600">
                      <p>Error: {contract.error || 'Failed to analyze contract'}</p>
                    </div>
                  ) : (
                    renderAnalysis(contract)
                  )}
                </div>
              ))}
              
              {hasMore && (
                <div className="text-center mt-6">
                  <button
                    onClick={() => loadContracts(true)}
                    disabled={isLoadingMore}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {isLoadingMore ? 'Loading...' : 'Load More'}
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="mt-8 text-center text-gray-600">
              <p>No contracts found. Upload your first contract to get started!</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}