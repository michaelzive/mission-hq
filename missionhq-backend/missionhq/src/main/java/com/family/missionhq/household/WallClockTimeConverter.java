package com.family.missionhq.household;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

import java.time.LocalTime;

/** A local time of day stored as 'HH:mm' text, so nothing in the JDBC stack shifts it by a time zone. */
@Converter
public class WallClockTimeConverter implements AttributeConverter<LocalTime, String> {
    @Override public String convertToDatabaseColumn(LocalTime t) { return t == null ? null : String.format("%02d:%02d", t.getHour(), t.getMinute()); }
    @Override public LocalTime convertToEntityAttribute(String s) { return s == null ? null : LocalTime.parse(s); }
}
