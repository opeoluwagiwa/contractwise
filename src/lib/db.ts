import { collection, addDoc, query, where, getDocs, doc, deleteDoc, setDoc, limit, startAfter, orderBy } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { db, storage } from './firebase';
import type { Contract, UserProfile } from '../types/contract';
import * as pdfjsLib from 'pdfjs-dist';
import { analyzeContractText } from './api';

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.mjs',
  import.meta.url
).toString();

const MAX_RETRIES = 3;
const BATCH_SIZE = 10;

async function extractTextFromPDF(file: File): Promise<string> {
  try {
    console.log('Starting PDF text extraction...');
    const arrayBuffer = await file.arrayBuffer();
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    const pdf = await loadingTask.promise;
    let fullText = '';
    
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .map((item: any) => item.str)
        .join(' ');
      fullText += pageText + ' ';
    }
    
    const extractedText = fullText.trim();
    console.log('Extracted text length:', extractedText.length);
    return extractedText;
  } catch (error) {
    console.error('Error extracting text from PDF:', error);
    throw new Error('Failed to extract text from PDF');
  }
}

async function retryOperation<T>(operation: () => Promise<T>, retries = MAX_RETRIES): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (retries > 0) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      return retryOperation(operation, retries - 1);
    }
    throw error;
  }
}

export const createUserProfile = async (user: UserProfile) => {
  const userRef = doc(db, 'users', user.id);
  await setDoc(userRef, {
    ...user,
    createdAt: new Date(),
    contractsAnalyzed: 0
  }, { merge: true });
};

export const uploadContract = async (file: File, userId: string) => {
  let uploadedFileUrl = '';
  let storageRef;
  let contractId = '';

  try {
    if (file.type !== 'application/pdf') {
      throw new Error('Only PDF files are supported');
    }

    if (file.size > 10 * 1024 * 1024) {
      throw new Error('File size must be less than 10MB');
    }

    // Create initial contract document with pending status
    const initialContract: Omit<Contract, 'id'> = {
      userId,
      title: file.name,
      fileName: file.name,
      fileType: file.type,
      fileUrl: '',
      status: 'pending',
      createdAt: new Date()
    };

    console.log('Creating initial contract document...');
    const docRef = await addDoc(collection(db, 'contracts'), initialContract);
    contractId = docRef.id;

    // Upload file to storage
    console.log('Uploading file to storage...');
    storageRef = ref(storage, `contracts/${userId}/${file.name}`);
    const uploadResult = await retryOperation(() => uploadBytes(storageRef, file));
    uploadedFileUrl = await retryOperation(() => getDownloadURL(uploadResult.ref));

    // Update contract with file URL
    console.log('Updating contract with file URL...');
    await setDoc(doc(db, 'contracts', contractId), {
      fileUrl: uploadedFileUrl
    }, { merge: true });

    // Extract text from PDF
    console.log('Extracting text from PDF...');
    const text = await extractTextFromPDF(file);
    
    if (!text) {
      throw new Error('No text could be extracted from the PDF');
    }

    // Analyze the contract
    console.log('Analyzing contract text...');
    const analysis = await analyzeContractText(text);
    console.log('Analysis completed:', analysis);

    // Update contract with analysis results
    const updatedContract: Partial<Contract> = {
      status: 'analyzed',
      analysis: {
        risks: analysis.risks || [],
        recommendations: analysis.recommendations || [],
        keyPoints: analysis.keyPoints || []
      }
    };

    console.log('Updating contract with analysis results...');
    await setDoc(doc(db, 'contracts', contractId), updatedContract, { merge: true });

    // Return the complete contract object
    const finalContract = {
      id: contractId,
      ...initialContract,
      fileUrl: uploadedFileUrl,
      status: 'analyzed',
      analysis: updatedContract.analysis
    };
    console.log('Final contract:', finalContract);
    return finalContract;
  } catch (error) {
    console.error('Error in uploadContract:', error);
    
    // Clean up the uploaded file if it exists
    if (uploadedFileUrl && storageRef) {
      try {
        await deleteObject(storageRef);
      } catch (cleanupError) {
        console.error('Error cleaning up storage:', cleanupError);
      }
    }

    // Update contract status to error if we have a contract ID
    if (contractId) {
      try {
        await setDoc(doc(db, 'contracts', contractId), {
          status: 'error',
          error: error instanceof Error ? error.message : 'Unknown error occurred'
        }, { merge: true });
      } catch (updateError) {
        console.error('Error updating contract status:', updateError);
      }
    }

    throw error;
  }
};

export const getUserContracts = async (userId: string, lastDoc?: any) => {
  try {
    let q = query(
      collection(db, 'contracts'),
      where('userId', '==', userId),
      orderBy('createdAt', 'desc'),
      limit(BATCH_SIZE)
    );

    if (lastDoc) {
      q = query(q, startAfter(lastDoc));
    }

    const querySnapshot = await getDocs(q);
    const contracts = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as Contract[];

    console.log('Retrieved contracts:', contracts);
    const hasMore = contracts.length === BATCH_SIZE;
    const lastVisible = querySnapshot.docs[querySnapshot.docs.length - 1];

    return {
      contracts,
      hasMore,
      lastVisible
    };
  } catch (error) {
    console.error('Error getting user contracts:', error);
    throw error;
  }
};

export const deleteContract = async (contract: Contract) => {
  try {
    // Delete file from storage with retry logic
    const storageRef = ref(storage, `contracts/${contract.userId}/${contract.fileName}`);
    await retryOperation(() => deleteObject(storageRef));

    // Delete document from Firestore with retry logic
    await retryOperation(() => deleteDoc(doc(db, 'contracts', contract.id)));
  } catch (error) {
    console.error('Error deleting contract:', error);
    throw error;
  }
};