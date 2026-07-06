import { Request, Response } from 'express';
import { VerificationStatus, VerificationStep } from '@kushlov/types';
import { AdminInstruction, VerificationRequest } from '../../models';
import { ApiError } from '../../utils/ApiError';
import { asyncHandler } from '../../utils/asyncHandler';
import { ok, created } from '../../utils/response';
import { uploadBuffer } from '../../services/media.service';

/** GET /verification/instructions — active capture instructions for the host. */
export const getInstructions = asyncHandler(async (_req: Request, res: Response) => {
  const instructions = await AdminInstruction.find({ isActive: true }).sort({ sortOrder: 1 });
  return ok(res, instructions);
});

/** GET /verification/me — the current user's verification request (if any). */
export const getMyVerification = asyncHandler(async (req: Request, res: Response) => {
  const request = await VerificationRequest.findOne({ user: req.user!.id }).sort({ createdAt: -1 });
  return ok(res, request);
});

/** POST /verification/basic — Step 1: create/update basic host info. */
export const submitBasic = asyncHandler(async (req: Request, res: Response) => {
  const { name, username, bio, gender, dob, languages, country } = req.body;
  const request = await VerificationRequest.findOneAndUpdate(
    { user: req.user!.id, status: { $in: [VerificationStatus.Pending, VerificationStatus.NeedMoreInfo] } },
    {
      $set: {
        user: req.user!.id,
        'basic.name': name,
        'basic.username': username,
        'basic.bio': bio,
        'basic.gender': gender,
        'basic.dob': dob,
        'basic.languages': languages ?? [],
        'basic.country': country,
        currentStep: VerificationStep.Documents,
        status: VerificationStatus.Pending,
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
  return created(res, request, 'Basic information saved');
});

/** POST /verification/documents — Step 2: government ID + optional address proof. */
export const submitDocuments = asyncHandler(async (req: Request, res: Response) => {
  const request = await VerificationRequest.findOne({ user: req.user!.id }).sort({ createdAt: -1 });
  if (!request) throw ApiError.badRequest('Complete Step 1 (basic info) first');

  const files = req.files as Record<string, Express.Multer.File[]> | undefined;
  const govId = files?.governmentId?.[0];
  if (!govId) throw ApiError.badRequest('Government ID is required');

  const govMedia = await uploadBuffer(govId, `verification/${req.user!.id}/documents`);
  request.documents.governmentId = { url: govMedia.url, publicId: govMedia.publicId };

  const addressProof = files?.addressProof?.[0];
  if (addressProof) {
    const addrMedia = await uploadBuffer(addressProof, `verification/${req.user!.id}/documents`);
    request.documents.addressProof = { url: addrMedia.url, publicId: addrMedia.publicId };
  }

  request.currentStep = VerificationStep.Identity;
  await request.save();
  return ok(res, request, 'Documents uploaded');
});

/**
 * POST /verification/identity — Step 3: 3 live selfies + 1 live video.
 * The client sends which admin instruction each capture satisfies.
 */
export const submitIdentity = asyncHandler(async (req: Request, res: Response) => {
  const request = await VerificationRequest.findOne({ user: req.user!.id }).sort({ createdAt: -1 });
  if (!request) throw ApiError.badRequest('Complete previous steps first');

  const files = req.files as Record<string, Express.Multer.File[]> | undefined;
  const selfies = files?.selfies ?? [];
  const video = files?.video?.[0];

  if (selfies.length < 3) throw ApiError.badRequest('Exactly 3 live selfie photos are required');
  if (!video) throw ApiError.badRequest('A live verification video is required');

  const instructions: string[] = Array.isArray(req.body.instructions)
    ? req.body.instructions
    : req.body.instructions
      ? [req.body.instructions]
      : [];

  const uploadedSelfies = [];
  for (let i = 0; i < selfies.length; i += 1) {
    const media = await uploadBuffer(selfies[i], `verification/${req.user!.id}/selfies`);
    uploadedSelfies.push({ url: media.url, publicId: media.publicId, instruction: instructions[i] });
  }
  const videoMedia = await uploadBuffer(video, `verification/${req.user!.id}/video`, {
    resource_type: 'video',
  });

  request.selfies = uploadedSelfies as any;
  request.verificationVideo = {
    url: videoMedia.url,
    publicId: videoMedia.publicId,
    instruction: req.body.videoInstruction,
  } as any;

  const activeInstructions = await AdminInstruction.find({ isActive: true }).distinct('_id');
  request.instructionsUsed = activeInstructions as any;
  request.currentStep = VerificationStep.Submitted;
  request.status = VerificationStatus.Pending;
  await request.save();

  return ok(res, request, 'Identity evidence submitted — pending admin review');
});
