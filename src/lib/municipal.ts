/**
 * Municipal intelligence: Annual Awareness Campaign Calendar and City Hall Holidays.
 * Campaigns are optional and user-selectable for newsletter inclusion.
 */

export interface AwarenessCampaign {
  id: string;
  month: number; // 1–12
  title: string;
  description: string;
  /** Key themes for the month (may be shared across campaigns). */
  keyThemes?: string;
  /** Mayor opportunities: proclamations, events, partnerships. */
  mayorOpportunities?: string;
}

export interface CityHallHoliday {
  month: number;
  day: number;
  title: string;
  description?: string;
}

/**
 * Annual Awareness Campaign Calendar for Mayors — national and community campaigns
 * commonly recognized with proclamations, social media, and community events.
 * Each campaign has a stable `id` for user selection persistence.
 */
export const MONTHLY_AWARENESS_CAMPAIGNS: AwarenessCampaign[] = [
  // January — Health, Mentorship, Human Trafficking
  { id: 'jan-national-mentoring-month', month: 1, title: 'National Mentoring Month', description: 'Partner with mentoring organizations; promote volunteerism.', keyThemes: 'Health, Mentorship, and Human Trafficking Awareness', mayorOpportunities: 'Partner with mentoring organizations, Promote volunteerism, Support anti-trafficking initiatives' },
  { id: 'jan-human-trafficking-awareness-month', month: 1, title: 'Human Trafficking Awareness Month', description: 'Support anti-trafficking initiatives and community education.', keyThemes: 'Health, Mentorship, and Human Trafficking Awareness', mayorOpportunities: 'Partner with mentoring organizations, Promote volunteerism, Support anti-trafficking initiatives' },
  { id: 'jan-poverty-awareness-month', month: 1, title: 'Poverty Awareness Month', description: 'Highlight poverty reduction and access to resources.', keyThemes: 'Health, Mentorship, and Human Trafficking Awareness', mayorOpportunities: 'Partner with mentoring organizations, Promote volunteerism, Support anti-trafficking initiatives' },
  { id: 'jan-national-blood-donor-month', month: 1, title: 'National Blood Donor Month', description: 'Promote blood drives and donor recruitment.', keyThemes: 'Health, Mentorship, and Human Trafficking Awareness', mayorOpportunities: 'Partner with mentoring organizations, Promote volunteerism, Support anti-trafficking initiatives' },
  { id: 'jan-cervical-cancer-awareness-month', month: 1, title: 'Cervical Cancer Awareness Month', description: 'Support screening and prevention messaging.', keyThemes: 'Health, Mentorship, and Human Trafficking Awareness', mayorOpportunities: 'Partner with mentoring organizations, Promote volunteerism, Support anti-trafficking initiatives' },
  { id: 'jan-slavery-human-trafficking-prevention-month', month: 1, title: 'National Slavery & Human Trafficking Prevention Month', description: 'Awareness and prevention of human trafficking.', keyThemes: 'Health, Mentorship, and Human Trafficking Awareness', mayorOpportunities: 'Partner with mentoring organizations, Promote volunteerism, Support anti-trafficking initiatives' },
  // February — Heart Health, Black History, Youth Leadership
  { id: 'feb-black-history-month', month: 2, title: 'Black History Month', description: 'Celebrate local Black leaders and history.', keyThemes: 'Heart Health, Black History, and Youth Leadership', mayorOpportunities: 'Celebrate local Black leaders, Heart health walks, Youth relationship education events' },
  { id: 'feb-american-heart-month', month: 2, title: 'American Heart Month', description: 'Heart health walks and cardiovascular awareness.', keyThemes: 'Heart Health, Black History, and Youth Leadership', mayorOpportunities: 'Celebrate local Black leaders, Heart health walks, Youth relationship education events' },
  { id: 'feb-teen-dating-violence-awareness-month', month: 2, title: 'Teen Dating Violence Awareness Month', description: 'Youth relationship education and healthy dating campaigns.', keyThemes: 'Heart Health, Black History, and Youth Leadership', mayorOpportunities: 'Celebrate local Black leaders, Heart health walks, Youth relationship education events' },
  { id: 'feb-childrens-dental-health-month', month: 2, title: 'National Children\'s Dental Health Month', description: 'Promote dental care and access for children.', keyThemes: 'Heart Health, Black History, and Youth Leadership', mayorOpportunities: 'Celebrate local Black leaders, Heart health walks, Youth relationship education events' },
  { id: 'feb-career-technical-education-month', month: 2, title: 'Career & Technical Education Month', description: 'Highlight CTE programs and workforce pathways.', keyThemes: 'Heart Health, Black History, and Youth Leadership', mayorOpportunities: 'Celebrate local Black leaders, Heart health walks, Youth relationship education events' },
  // March — Disabilities, Women's History, Community Safety
  { id: 'mar-womens-history-month', month: 3, title: 'Women\'s History Month', description: 'Women leaders recognition and celebration.', keyThemes: 'Disabilities, Women\'s History, and Community Safety', mayorOpportunities: 'Women leaders recognition ceremony, Disability inclusion initiatives, Community health education' },
  { id: 'mar-developmental-disabilities-awareness-month', month: 3, title: 'Developmental Disabilities Awareness Month', description: 'Disability inclusion initiatives and supports.', keyThemes: 'Disabilities, Women\'s History, and Community Safety', mayorOpportunities: 'Women leaders recognition ceremony, Disability inclusion initiatives, Community health education' },
  { id: 'mar-national-nutrition-month', month: 3, title: 'National Nutrition Month', description: 'Community health and nutrition education.', keyThemes: 'Disabilities, Women\'s History, and Community Safety', mayorOpportunities: 'Women leaders recognition ceremony, Disability inclusion initiatives, Community health education' },
  { id: 'mar-problem-gambling-awareness-month', month: 3, title: 'Problem Gambling Awareness Month', description: 'Awareness and resources for problem gambling.', keyThemes: 'Disabilities, Women\'s History, and Community Safety', mayorOpportunities: 'Women leaders recognition ceremony, Disability inclusion initiatives, Community health education' },
  { id: 'mar-brain-injury-awareness-month', month: 3, title: 'Brain Injury Awareness Month', description: 'Prevention and support for brain injury survivors.', keyThemes: 'Disabilities, Women\'s History, and Community Safety', mayorOpportunities: 'Women leaders recognition ceremony, Disability inclusion initiatives, Community health education' },
  // April — Environment, Child Protection, Community Service
  { id: 'apr-child-abuse-prevention-month', month: 4, title: 'Child Abuse Prevention Month', description: 'Child protection awareness and family support.', keyThemes: 'Environment, Child Protection, and Community Service', mayorOpportunities: 'Volunteer appreciation events, Environmental clean-up days, Child protection awareness campaigns' },
  { id: 'apr-autism-acceptance-month', month: 4, title: 'Autism Acceptance Month', description: 'Autism acceptance and inclusion initiatives.', keyThemes: 'Environment, Child Protection, and Community Service', mayorOpportunities: 'Volunteer appreciation events, Environmental clean-up days, Child protection awareness campaigns' },
  { id: 'apr-sexual-assault-awareness-month', month: 4, title: 'Sexual Assault Awareness Month', description: 'Support survivors and prevention education.', keyThemes: 'Environment, Child Protection, and Community Service', mayorOpportunities: 'Volunteer appreciation events, Environmental clean-up days, Child protection awareness campaigns' },
  { id: 'apr-national-volunteer-month', month: 4, title: 'National Volunteer Month', description: 'Volunteer appreciation and recruitment.', keyThemes: 'Environment, Child Protection, and Community Service', mayorOpportunities: 'Volunteer appreciation events, Environmental clean-up days, Child protection awareness campaigns' },
  { id: 'apr-fair-housing-month', month: 4, title: 'Fair Housing Month', description: 'Fair housing rights and equitable access.', keyThemes: 'Environment, Child Protection, and Community Service', mayorOpportunities: 'Volunteer appreciation events, Environmental clean-up days, Child protection awareness campaigns' },
  { id: 'apr-earth-month', month: 4, title: 'Earth Month', description: 'Environmental clean-up days and sustainability.', keyThemes: 'Environment, Child Protection, and Community Service', mayorOpportunities: 'Volunteer appreciation events, Environmental clean-up days, Child protection awareness campaigns' },
  // May — Mental Health, Public Safety, Military Appreciation
  { id: 'may-mental-health-awareness-month', month: 5, title: 'Mental Health Awareness Month', description: 'Mental health town hall and resource promotion.', keyThemes: 'Mental Health, Public Safety, and Military Appreciation', mayorOpportunities: 'Mental health town hall, Veteran recognition events, Community fitness activities' },
  { id: 'may-military-appreciation-month', month: 5, title: 'National Military Appreciation Month', description: 'Veteran recognition events and military families support.', keyThemes: 'Mental Health, Public Safety, and Military Appreciation', mayorOpportunities: 'Mental health town hall, Veteran recognition events, Community fitness activities' },
  { id: 'may-older-americans-month', month: 5, title: 'Older Americans Month', description: 'Honor seniors and aging services.', keyThemes: 'Mental Health, Public Safety, and Military Appreciation', mayorOpportunities: 'Mental health town hall, Veteran recognition events, Community fitness activities' },
  { id: 'may-foster-care-month', month: 5, title: 'National Foster Care Month', description: 'Support foster families and youth in care.', keyThemes: 'Mental Health, Public Safety, and Military Appreciation', mayorOpportunities: 'Mental health town hall, Veteran recognition events, Community fitness activities' },
  { id: 'may-national-bike-month', month: 5, title: 'National Bike Month', description: 'Bike safety and active transportation.', keyThemes: 'Mental Health, Public Safety, and Military Appreciation', mayorOpportunities: 'Mental health town hall, Veteran recognition events, Community fitness activities' },
  { id: 'may-physical-fitness-sports-month', month: 5, title: 'National Physical Fitness & Sports Month', description: 'Community fitness activities and sports.', keyThemes: 'Mental Health, Public Safety, and Military Appreciation', mayorOpportunities: 'Mental health town hall, Veteran recognition events, Community fitness activities' },
  // June — Safety, Family Well-Being, Inclusion
  { id: 'jun-pride-month', month: 6, title: 'Pride Month', description: 'LGBTQ+ inclusion and celebration.', keyThemes: 'Safety, Family Well-Being, and Inclusion', mayorOpportunities: 'Senior wellness programs, Public safety campaigns, Veteran mental health support' },
  { id: 'jun-alzheimers-brain-awareness-month', month: 6, title: 'Alzheimer\'s & Brain Awareness Month', description: 'Brain health and caregiver support.', keyThemes: 'Safety, Family Well-Being, and Inclusion', mayorOpportunities: 'Senior wellness programs, Public safety campaigns, Veteran mental health support' },
  { id: 'jun-mens-health-month', month: 6, title: 'Men\'s Health Month', description: 'Men\'s health screenings and awareness.', keyThemes: 'Safety, Family Well-Being, and Inclusion', mayorOpportunities: 'Senior wellness programs, Public safety campaigns, Veteran mental health support' },
  { id: 'jun-national-safety-month', month: 6, title: 'National Safety Month', description: 'Public safety campaigns and injury prevention.', keyThemes: 'Safety, Family Well-Being, and Inclusion', mayorOpportunities: 'Senior wellness programs, Public safety campaigns, Veteran mental health support' },
  { id: 'jun-ptsd-awareness-month', month: 6, title: 'PTSD Awareness Month', description: 'Veteran mental health support and trauma awareness.', keyThemes: 'Safety, Family Well-Being, and Inclusion', mayorOpportunities: 'Senior wellness programs, Public safety campaigns, Veteran mental health support' },
  // July — Community Heritage and Parks
  { id: 'jul-parks-recreation-month', month: 7, title: 'Parks & Recreation Month', description: 'Park events and outdoor programming.', keyThemes: 'Community Heritage and Parks', mayorOpportunities: 'Park events, Disability accessibility initiatives, Cultural heritage celebrations' },
  { id: 'jul-minority-mental-health-awareness-month', month: 7, title: 'Minority Mental Health Awareness Month', description: 'Culturally responsive mental health support.', keyThemes: 'Community Heritage and Parks', mayorOpportunities: 'Park events, Disability accessibility initiatives, Cultural heritage celebrations' },
  { id: 'jul-disability-independence-month', month: 7, title: 'National Disability Independence Month', description: 'Disability accessibility and inclusion.', keyThemes: 'Community Heritage and Parks', mayorOpportunities: 'Park events, Disability accessibility initiatives, Cultural heritage celebrations' },
  // August — Children, Road Safety, Immunization
  { id: 'aug-immunization-awareness-month', month: 8, title: 'National Immunization Awareness Month', description: 'School readiness and vaccination messaging.', keyThemes: 'Children, Road Safety, and Immunization', mayorOpportunities: 'School readiness campaigns, Public health messaging' },
  { id: 'aug-childrens-vision-learning-month', month: 8, title: 'Children\'s Vision & Learning Month', description: 'Vision screening and learning readiness.', keyThemes: 'Children, Road Safety, and Immunization', mayorOpportunities: 'School readiness campaigns, Public health messaging' },
  { id: 'aug-national-breastfeeding-month', month: 8, title: 'National Breastfeeding Month', description: 'Support nursing families and lactation resources.', keyThemes: 'Children, Road Safety, and Immunization', mayorOpportunities: 'School readiness campaigns, Public health messaging' },
  { id: 'aug-traffic-awareness-month', month: 8, title: 'National Traffic Awareness Month', description: 'Road safety and traffic awareness.', keyThemes: 'Children, Road Safety, and Immunization', mayorOpportunities: 'School readiness campaigns, Public health messaging' },
  // September — Suicide Prevention, Recovery, Preparedness
  { id: 'sep-suicide-prevention-month', month: 9, title: 'Suicide Prevention Month', description: 'Suicide prevention trainings (e.g. QPR) and crisis resources.', keyThemes: 'Suicide Prevention, Recovery, and Preparedness', mayorOpportunities: 'Suicide prevention trainings, Emergency preparedness campaigns, Addiction recovery support' },
  { id: 'sep-national-recovery-month', month: 9, title: 'National Recovery Month', description: 'Addiction recovery support and stigma reduction.', keyThemes: 'Suicide Prevention, Recovery, and Preparedness', mayorOpportunities: 'Suicide prevention trainings, Emergency preparedness campaigns, Addiction recovery support' },
  { id: 'sep-national-preparedness-month', month: 9, title: 'National Preparedness Month', description: 'Emergency preparedness campaigns and resilience.', keyThemes: 'Suicide Prevention, Recovery, and Preparedness', mayorOpportunities: 'Suicide prevention trainings, Emergency preparedness campaigns, Addiction recovery support' },
  { id: 'sep-childhood-cancer-awareness-month', month: 9, title: 'Childhood Cancer Awareness Month', description: 'Support families and pediatric cancer research.', keyThemes: 'Suicide Prevention, Recovery, and Preparedness', mayorOpportunities: 'Suicide prevention trainings, Emergency preparedness campaigns, Addiction recovery support' },
  { id: 'sep-hunger-action-month', month: 9, title: 'Hunger Action Month', description: 'Food security and hunger relief initiatives.', keyThemes: 'Suicide Prevention, Recovery, and Preparedness', mayorOpportunities: 'Suicide prevention trainings, Emergency preparedness campaigns, Addiction recovery support' },
  // October — Domestic Violence, Breast Cancer, Cybersecurity
  { id: 'oct-domestic-violence-awareness-month', month: 10, title: 'Domestic Violence Awareness Month', description: 'Survivor support and prevention events.', keyThemes: 'Domestic Violence, Breast Cancer, and Cybersecurity', mayorOpportunities: 'Domestic violence survivor support events, Technology safety workshops, Employer inclusion initiatives' },
  { id: 'oct-breast-cancer-awareness-month', month: 10, title: 'Breast Cancer Awareness Month', description: 'Screening and support for those affected.', keyThemes: 'Domestic Violence, Breast Cancer, and Cybersecurity', mayorOpportunities: 'Domestic violence survivor support events, Technology safety workshops, Employer inclusion initiatives' },
  { id: 'oct-cybersecurity-awareness-month', month: 10, title: 'Cybersecurity Awareness Month', description: 'Technology safety workshops and cyber hygiene.', keyThemes: 'Domestic Violence, Breast Cancer, and Cybersecurity', mayorOpportunities: 'Domestic violence survivor support events, Technology safety workshops, Employer inclusion initiatives' },
  { id: 'oct-disability-employment-awareness-month', month: 10, title: 'National Disability Employment Awareness Month', description: 'Employer inclusion and disability employment.', keyThemes: 'Domestic Violence, Breast Cancer, and Cybersecurity', mayorOpportunities: 'Domestic violence survivor support events, Technology safety workshops, Employer inclusion initiatives' },
  { id: 'oct-bullying-prevention-month', month: 10, title: 'Bullying Prevention Month', description: 'School and community bullying prevention.', keyThemes: 'Domestic Violence, Breast Cancer, and Cybersecurity', mayorOpportunities: 'Domestic violence survivor support events, Technology safety workshops, Employer inclusion initiatives' },
  // November — Veterans, Diabetes, Family Caregiving
  { id: 'nov-veterans-military-families-month', month: 11, title: 'Veterans & Military Families Month', description: 'Veteran recognition ceremonies and family support.', keyThemes: 'Veterans, Diabetes, and Family Caregiving', mayorOpportunities: 'Veteran recognition ceremonies, Community health screenings' },
  { id: 'nov-diabetes-awareness-month', month: 11, title: 'National Diabetes Awareness Month', description: 'Community health screenings and diabetes education.', keyThemes: 'Veterans, Diabetes, and Family Caregiving', mayorOpportunities: 'Veteran recognition ceremonies, Community health screenings' },
  { id: 'nov-family-caregivers-month', month: 11, title: 'National Family Caregivers Month', description: 'Support for family caregivers.', keyThemes: 'Veterans, Diabetes, and Family Caregiving', mayorOpportunities: 'Veteran recognition ceremonies, Community health screenings' },
  { id: 'nov-native-american-heritage-month', month: 11, title: 'Native American Heritage Month', description: 'Honor Indigenous peoples and heritage.', keyThemes: 'Veterans, Diabetes, and Family Caregiving', mayorOpportunities: 'Veteran recognition ceremonies, Community health screenings' },
  { id: 'nov-lung-cancer-awareness-month', month: 11, title: 'Lung Cancer Awareness Month', description: 'Screening and prevention awareness.', keyThemes: 'Veterans, Diabetes, and Family Caregiving', mayorOpportunities: 'Veteran recognition ceremonies, Community health screenings' },
  // December — Giving, HIV Awareness, Volunteerism
  { id: 'dec-universal-human-rights-month', month: 12, title: 'Universal Human Rights Month', description: 'Human rights and dignity for all.', keyThemes: 'Giving, HIV Awareness, and Volunteerism', mayorOpportunities: 'Holiday volunteer drives, Public safety campaigns' },
  { id: 'dec-hiv-aids-awareness-month', month: 12, title: 'HIV/AIDS Awareness Month', description: 'Testing, treatment, and stigma reduction.', keyThemes: 'Giving, HIV Awareness, and Volunteerism', mayorOpportunities: 'Holiday volunteer drives, Public safety campaigns' },
  { id: 'dec-impaired-driving-prevention-month', month: 12, title: 'National Impaired Driving Prevention Month', description: 'Public safety campaigns and sober driving.', keyThemes: 'Giving, HIV Awareness, and Volunteerism', mayorOpportunities: 'Holiday volunteer drives, Public safety campaigns' },
];

/** City Hall holidays (observed closures and observances). */
export const CITY_HALL_HOLIDAYS: CityHallHoliday[] = [
  { month: 1, day: 1, title: 'New Year\'s Day', description: 'City Hall closed.' },
  { month: 1, day: 20, title: 'Martin Luther King Jr. Day', description: 'City Hall closed.' },
  { month: 2, day: 17, title: 'Presidents\' Day', description: 'City Hall closed.' },
  { month: 5, day: 27, title: 'Memorial Day', description: 'City Hall closed.' },
  { month: 6, day: 19, title: 'Juneteenth', description: 'City Hall closed.' },
  { month: 7, day: 4, title: 'Independence Day', description: 'City Hall closed.' },
  { month: 9, day: 2, title: 'Labor Day', description: 'City Hall closed.' },
  { month: 10, day: 14, title: 'Columbus Day / Indigenous Peoples\' Day', description: 'City Hall closed.' },
  { month: 11, day: 11, title: 'Veterans Day', description: 'City Hall closed.' },
  { month: 11, day: 28, title: 'Thanksgiving Day', description: 'City Hall closed.' },
  { month: 11, day: 29, title: 'Day After Thanksgiving', description: 'City Hall closed.' },
  { month: 12, day: 25, title: 'Christmas Day', description: 'City Hall closed.' },
  { month: 12, day: 31, title: 'New Year\'s Eve', description: 'City Hall early closure.' },
];

const SETTINGS_KEY_SELECTED_CAMPAIGNS = 'selectedAwarenessCampaignIds';

/**
 * Returns awareness campaigns that apply to any month in the given date range.
 * If `selectedIds` is provided and non-empty, only campaigns whose `id` is in the set are returned.
 * If `selectedIds` is null/undefined or empty, all campaigns in range are returned (default: include all).
 */
export function getAwarenessCampaignsForRange(
  startDate: Date,
  endDate: Date,
  selectedIds?: Set<string> | null
): AwarenessCampaign[] {
  const months = new Set<number>();
  const cur = new Date(startDate);
  const end = new Date(endDate);
  while (cur <= end) {
    months.add(cur.getMonth() + 1);
    cur.setMonth(cur.getMonth() + 1);
  }
  let list = MONTHLY_AWARENESS_CAMPAIGNS.filter((c) => months.has(c.month));
  if (selectedIds != null && selectedIds.size > 0) {
    list = list.filter((c) => selectedIds.has(c.id));
  }
  return list;
}

/**
 * Returns City Hall holidays that fall within the given date range (year-aware).
 */
export function getCityHallHolidaysForRange(startDate: Date, endDate: Date): Array<CityHallHoliday & { date: string }> {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const result: Array<CityHallHoliday & { date: string }> = [];
  const startYear = start.getFullYear();
  const endYear = end.getFullYear();
  for (let year = startYear; year <= endYear; year++) {
    for (const h of CITY_HALL_HOLIDAYS) {
      const d = new Date(year, h.month - 1, h.day);
      if (d >= start && d <= end) {
        result.push({
          ...h,
          date: d.toISOString().slice(0, 10),
        });
      }
    }
  }
  return result.sort((a, b) => a.date.localeCompare(b.date));
}

/** All campaign IDs (for "select all" / "deselect all"). */
export function getAllAwarenessCampaignIds(): string[] {
  return MONTHLY_AWARENESS_CAMPAIGNS.map((c) => c.id);
}

export { SETTINGS_KEY_SELECTED_CAMPAIGNS };
