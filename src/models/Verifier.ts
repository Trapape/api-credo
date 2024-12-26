const universityDegreePresentationDefinition = {
  id: "UniversityDegreeCredential",
  purpose:
    "Present your UniversityDegreeCredential to verify your education level.",
  input_descriptors: [
    {
      id: "UniversityDegreeCredentialDescriptor",
      constraints: {
        fields: [
          {
            path: ["$.vc.type.*", "$.vct", "$.type"],
            filter: {
              type: "string",
              pattern: "UniversityDegree",
            },
          },
        ],
      },
    },
  ],
};

const openBadgeCredentialPresentationDefinition = {
  id: "OpenBadgeCredential",
  purpose: "Provide proof of employment to confirm your employment status.",
  input_descriptors: [
    {
      id: "OpenBadgeCredentialDescriptor",
      constraints: {
        fields: [
          {
            path: ["$.vc.type.*", "$.vct", "$.type"],
            filter: {
              type: "string",
              pattern: "OpenBadgeCredential",
            },
          },
        ],
      },
    },
  ],
};

const tantanPresentationDefinition = {
  id: "TantanCredential",
  purpose: "Present your Tantan Credential to verify your identity.",
  input_descriptors: [
    {
      id: "TantanCredentialDescriptor",
      constraints: {
        fields: [
          {
            path: ["$.vc.type.*", "$.type"],
            filter: {
              type: "string",
              pattern: "TantanCredential",
            },
          },
        ],
      },
    },
  ],
};

export const presentationDefinitions = [
  universityDegreePresentationDefinition,
  openBadgeCredentialPresentationDefinition,
  tantanPresentationDefinition,
];
